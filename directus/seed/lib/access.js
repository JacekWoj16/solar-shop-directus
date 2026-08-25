/**
 * Access configuration.
 *
 * Roles, policies and permissions are *data* in Directus system collections,
 * not schema — `directus schema snapshot` does not capture them. Without this
 * step a freshly applied schema serves 403 to the storefront, so configuring
 * access is part of seeding rather than an afterthought in the README.
 *
 * Two grants are set up:
 *
 *   Public policy      read-only catalogue access, no credentials. This is
 *                      what makes the storefront statically cacheable.
 *
 *   Storefront role    a dedicated user whose static token can create orders.
 *                      Deliberately not the admin token: a leaked storefront
 *                      token should not be able to rewrite the price list.
 */

/** Directus ships the public policy under a translation key, not a plain name. */
const PUBLIC_POLICY_NAME = '$t:public_label';

const STOREFRONT_ROLE_NAME = 'Storefront';
const STOREFRONT_POLICY_NAME = 'Storefront (order intake)';
const STOREFRONT_USER_EMAIL = 'storefront@example.com';

/** Catalogue reads available without authentication. */
const PUBLIC_PERMISSIONS = [
  { collection: 'categories', filter: { is_active: { _eq: true } } },
  { collection: 'products', filter: { is_active: { _eq: true } } },
  // Tiers carry no visibility flag of their own; they are reachable only
  // through a product, which is already filtered.
  { collection: 'price_tiers', filter: null },
  { collection: 'pages', filter: { status: { _eq: 'published' } } },
];

/**
 * What the storefront's server-side token may do. Read access to the catalogue
 * is included because the order route re-reads prices from Directus rather than
 * trusting the cart.
 */
const STOREFRONT_PERMISSIONS = [
  { collection: 'orders', action: 'create' },
  { collection: 'orders', action: 'read' },
  { collection: 'order_items', action: 'create' },
  { collection: 'order_items', action: 'read' },
  { collection: 'products', action: 'read' },
  { collection: 'price_tiers', action: 'read' },
  { collection: 'categories', action: 'read' },
];

async function findPolicyByName(client, name) {
  const encoded = encodeURIComponent(name);
  const policies = await client.get(
    `/policies?filter[name][_eq]=${encoded}&fields=id,name&limit=1`,
  );
  return policies?.[0] ?? null;
}

/** Replaces a policy's permissions on one collection, so reruns stay clean. */
async function setPermission(client, policyId, collection, action, filter) {
  const existing = await client.get(
    `/permissions?filter[policy][_eq]=${policyId}` +
      `&filter[collection][_eq]=${collection}` +
      `&filter[action][_eq]=${action}&fields=id&limit=1`,
  );

  const payload = {
    policy: policyId,
    collection,
    action,
    fields: ['*'],
    permissions: filter ?? {},
    validation: {},
  };

  if (existing?.length) {
    await client.patch(`/permissions/${existing[0].id}`, payload);
    return 'updated';
  }

  await client.post('/permissions', payload);
  return 'created';
}

/** Grants anonymous read access to the catalogue. */
export async function configurePublicAccess(client, log) {
  const policy = await findPolicyByName(client, PUBLIC_POLICY_NAME);

  if (!policy) {
    throw new Error(
      'Public policy not found. This instance may predate Directus 11 policies.',
    );
  }

  for (const { collection, filter } of PUBLIC_PERMISSIONS) {
    const outcome = await setPermission(client, policy.id, collection, 'read', filter);
    log(`  public read on ${collection} (${outcome})`);
  }
}

/**
 * Creates the storefront role, policy and user, and issues a static token.
 *
 * Returns the token so the caller can print it. Directus stores tokens
 * reversibly and never shows them again in the UI, so an existing user is given
 * a fresh token rather than being left in an unusable state.
 */
export async function configureStorefrontAccess(client, log) {
  const [existingPolicy] = await client.get(
    `/policies?filter[name][_eq]=${encodeURIComponent(STOREFRONT_POLICY_NAME)}&fields=id&limit=1`,
  );

  const policyId =
    existingPolicy?.id ??
    (
      await client.post('/policies', {
        name: STOREFRONT_POLICY_NAME,
        icon: 'storefront',
        description:
          'Server-side order intake for the Next.js storefront. No admin or app access.',
        admin_access: false,
        app_access: false,
      })
    ).id;
  log(`  policy "${STOREFRONT_POLICY_NAME}" (${existingPolicy ? 'exists' : 'created'})`);

  for (const { collection, action } of STOREFRONT_PERMISSIONS) {
    await setPermission(client, policyId, collection, action, null);
  }
  log(`  ${STOREFRONT_PERMISSIONS.length} permissions on the storefront policy`);

  const [existingRole] = await client.get(
    `/roles?filter[name][_eq]=${STOREFRONT_ROLE_NAME}&fields=id&limit=1`,
  );

  const roleId =
    existingRole?.id ??
    (
      await client.post('/roles', {
        name: STOREFRONT_ROLE_NAME,
        icon: 'storefront',
        description: 'Machine account used by the storefront to create orders.',
      })
    ).id;
  log(`  role "${STOREFRONT_ROLE_NAME}" (${existingRole ? 'exists' : 'created'})`);

  // Link policy to role if not already linked.
  const access = await client.get(
    `/access?filter[role][_eq]=${roleId}&filter[policy][_eq]=${policyId}&fields=id&limit=1`,
  );
  if (!access?.length) {
    await client.post('/access', { role: roleId, policy: policyId });
  }

  const token = generateToken();

  const [existingUser] = await client.get(
    `/users?filter[email][_eq]=${STOREFRONT_USER_EMAIL}&fields=id&limit=1`,
  );

  if (existingUser) {
    await client.patch(`/users/${existingUser.id}`, { role: roleId, token });
    log(`  user ${STOREFRONT_USER_EMAIL} (token reissued)`);
  } else {
    await client.post('/users', {
      email: STOREFRONT_USER_EMAIL,
      first_name: 'Storefront',
      last_name: 'Service',
      role: roleId,
      token,
      status: 'active',
    });
    log(`  user ${STOREFRONT_USER_EMAIL} (created)`);
  }

  return token;
}

function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
