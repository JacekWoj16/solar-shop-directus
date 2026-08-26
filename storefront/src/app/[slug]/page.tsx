import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getPage, getPageSlugs } from '@/lib/api';
import { formatDate } from '@/lib/format';

/**
 * Editorial pages: /about, /contact, /terms.
 *
 * One route rather than three near-identical files, because the difference
 * between them is entirely content and that content lives in Directus. Adding a
 * fourth page is then a CMS action, not a deploy.
 *
 * Every published page is prerendered at build time from `generateStaticParams`.
 * Dynamic params stay enabled, so a page published after the build is rendered
 * on first request instead of 404ing until someone redeploys — the whole point
 * of putting the copy in a CMS.
 */
export async function generateStaticParams() {
  const slugs = await getPageSlugs();
  return slugs.map((slug) => ({ slug }));
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);

  if (!page) return { title: 'Page not found' };

  return { title: page.title };
}

export default async function EditorialPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPage(slug);

  // Also the catch-all for any unmatched top-level path, since this route sits
  // at the root. Static segments like /cart and /search are matched first.
  if (!page) notFound();

  return (
    <div className="shell max-w-3xl py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <Link href="/" className="transition-colors hover:text-brand">
          Home
        </Link>
        <span className="mx-2 text-ink-subtle">/</span>
        <span className="text-ink">{page.title}</span>
      </nav>

      <h1 className="mt-4 text-2xl text-ink sm:text-3xl">{page.title}</h1>

      {/* The HTML comes from the Directus WYSIWYG, which only the shop owner can
          reach — the public role has read access and nothing more. It is
          rendered unsanitised on that basis. Widening editorial access to
          people who are not fully trusted would make sanitising this a
          prerequisite, not an improvement. */}
      <article
        className="cms-content mt-6"
        dangerouslySetInnerHTML={{ __html: page.content }}
      />

      {page.date_updated ? (
        <p className="mt-10 border-t border-line pt-4 text-xs text-ink-subtle">
          Last updated {formatDate(page.date_updated)}
        </p>
      ) : null}
    </div>
  );
}
