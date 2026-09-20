export interface ApprovedGobPeSource {
  id: string;
  url: string;
  enabled: boolean;
}

/** Only a concrete, approved page is eligible; directory roots are not. */
export function isSpecificGobPeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'gob.pe' || url.hostname === 'www.gob.pe') && url.pathname !== '/';
  } catch {
    return false;
  }
}

/**
 * Fetches exactly one pre-approved source URL. Redirects are rejected so an
 * approved page cannot silently turn this adapter into a domain crawler.
 */
export async function fetchApprovedGobPeSource(source: ApprovedGobPeSource, fetcher: typeof fetch = fetch): Promise<Response> {
  if (!source.enabled) throw new Error('La fuente está deshabilitada.');
  if (!isSpecificGobPeUrl(source.url)) throw new Error('La fuente debe usar una URL específica de gob.pe.');
  return fetcher(source.url, { redirect: 'error' });
}
