import Link from 'next/link';
import { cacheLife } from 'next/cache';

import { BANK, PAYMENT_TERM_DAYS, SELLER } from '@/lib/constants';
import { formatNip } from '@/lib/nip';

/**
 * Reading the clock is dynamic, and a copyright year in a prerendered footer
 * would otherwise force every page on the site to render per request. Caching
 * it for a day keeps the footer static and still rolls the year over on time.
 */
async function currentYear(): Promise<number> {
  'use cache';
  cacheLife('days');
  return new Date().getFullYear();
}

export async function Footer() {
  const year = await currentYear();

  return (
    <footer className="mt-16 bg-footer text-ink-inverse">
      <div className="shell grid grid-cols-1 gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-base font-semibold">{SELLER.name}</p>
          <address className="mt-3 space-y-0.5 text-sm not-italic text-stone-400">
            <p>{SELLER.address}</p>
            <p>
              {SELLER.postalCode} {SELLER.city}
            </p>
            <p>NIP {formatNip(SELLER.nip)}</p>
          </address>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider">Ordering</h2>
          <ul className="mt-3 space-y-2 text-sm text-stone-400">
            <li>
              <Link href="/terms" className="transition-colors hover:text-white">
                Terms and conditions
              </Link>
            </li>
            <li>
              <Link href="/contact" className="transition-colors hover:text-white">
                Contact sales
              </Link>
            </li>
            <li>Trade customers only</li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider">Payment</h2>
          <ul className="mt-3 space-y-2 text-sm text-stone-400">
            <li>Bank transfer against a proforma invoice</li>
            <li>Payable within {PAYMENT_TERM_DAYS} days</li>
            <li className="font-mono text-xs">{BANK.iban}</li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider">Contact</h2>
          <ul className="mt-3 space-y-2 text-sm text-stone-400">
            <li>
              <a
                href={`mailto:${SELLER.email}`}
                className="transition-colors hover:text-white"
              >
                {SELLER.email}
              </a>
            </li>
            <li>{SELLER.phone}</li>
            <li>Mon–Fri, 08:00–16:00</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-stone-800">
        <div className="shell flex flex-col gap-1 py-5 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {SELLER.name}. All prices net of VAT.
          </p>
          <p>A portfolio project. The company is fictional and nothing is for sale.</p>
        </div>
      </div>
    </footer>
  );
}
