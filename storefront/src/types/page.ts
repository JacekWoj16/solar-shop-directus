/** Editorial content managed in Directus: about, contact, terms. */
export interface Page {
  id: string;
  slug: string;
  title: string;
  /** Rich text (HTML) authored in the Directus WYSIWYG field. */
  content: string;
  status: 'published' | 'draft';
  date_updated: string | null;
}
