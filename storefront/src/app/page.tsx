import { getCategories } from '@/lib/api';
import { CategoryGrid } from '@/components/home/CategoryGrid';

/**
 * Fully prerendered: every piece of data on this page is cacheable, so there is
 * no dynamic hole for Next to stream into. Its lifetime comes from the
 * `structure` profile on `getCategories`, not from a route segment export.
 */
export default async function HomePage() {
  const categories = await getCategories();

  return (
    <div className="shell py-14">
      <section className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-wider text-brand">
          B2B photovoltaic wholesale
        </p>
        <h1 className="mt-3 text-4xl text-ink sm:text-5xl">
          Order panels, inverters and mounting by the pallet.
        </h1>
        <p className="mt-5 text-lg text-ink-muted">
          Net prices, volume discounts that apply as you type the quantity, and a
          proforma invoice the moment you place the order.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Categories
        </h2>
        <CategoryGrid categories={categories} />
      </section>
    </div>
  );
}
