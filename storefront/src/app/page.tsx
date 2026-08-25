/**
 * Home page.
 *
 * Statically generated and refreshed hourly: the hero copy is fixed and the
 * category tiles (added once Directus is seeded) change no more often than the
 * catalogue itself.
 */
// Route segment config must be a literal: Next evaluates it statically at
// build time and cannot resolve an imported constant. See docs/ARCHITECTURE.md
// for the full rendering strategy.
export const revalidate = 3600; // 1 hour

export default function HomePage() {
  return (
    <div className="shell py-16">
      <section className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-wider text-brand">
          B2B photovoltaic wholesale
        </p>
        <h1 className="mt-3 text-4xl text-ink sm:text-5xl">
          Order panels, inverters and mounting by the pallet.
        </h1>
        <p className="mt-5 text-lg text-ink-muted">
          Net prices, volume discounts that apply as you type the quantity, and
          a proforma invoice the moment you place the order.
        </p>
      </section>

      <section className="mt-12 rounded-lg border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Scaffold
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          The catalogue surfaces — category product tables, search, cart and
          checkout — are built on top of the domain layer in{' '}
          <code className="font-mono text-xs text-ink">src/lib</code>. Start
          Directus with <code className="font-mono text-xs text-ink">docker compose up -d</code>{' '}
          and seed it to populate this page.
        </p>
      </section>
    </div>
  );
}
