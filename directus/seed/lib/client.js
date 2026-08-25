/**
 * Minimal Directus REST helper.
 *
 * The seed script deliberately uses `fetch` rather than the SDK: it runs
 * against a bare instance where the schema may have just been applied, and a
 * thin, untyped client makes failures easier to read than a typed one whose
 * schema no longer matches.
 */

export class DirectusError extends Error {
  constructor(method, path, status, body) {
    const detail = body?.errors?.map((e) => e.message).join('; ') ?? JSON.stringify(body);
    super(`${method} ${path} → ${status}: ${detail}`);
    this.name = 'DirectusError';
    this.status = status;
    this.body = body;
  }
}

export function createClient({ url, email, password, token }) {
  let accessToken = token ?? '';

  async function request(method, path, body) {
    const response = await fetch(`${url}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    const json = text ? JSON.parse(text) : null;

    if (!response.ok) throw new DirectusError(method, path, response.status, json);
    return json?.data;
  }

  return {
    async login() {
      if (accessToken) return;
      const data = await request('POST', '/auth/login', { email, password });
      accessToken = data.access_token;
    },

    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    delete: (path, body) => request('DELETE', path, body),

    /**
     * Waits for the instance to answer health checks. A freshly started
     * container accepts connections before it is ready to serve the API.
     */
    async waitUntilReady(attempts = 30, delayMs = 2000) {
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          const response = await fetch(`${url}/server/health`);
          const body = await response.json();
          if (body?.status === 'ok') return;
        } catch {
          // Not up yet.
        }
        if (attempt === attempts) {
          throw new Error(`Directus at ${url} did not become healthy in time.`);
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    },
  };
}

/** Inserts in batches; Directus rejects very large single payloads. */
export async function createMany(client, collection, records, batchSize = 100) {
  const created = [];
  for (let index = 0; index < records.length; index += batchSize) {
    const batch = records.slice(index, index + batchSize);
    const result = await client.post(`/items/${collection}`, batch);
    created.push(...(Array.isArray(result) ? result : [result]));
  }
  return created;
}
