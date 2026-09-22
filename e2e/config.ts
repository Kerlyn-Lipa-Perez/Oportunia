type Environment = Readonly<Record<string, string | undefined>>;

const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
]);

export function resolveExternalBaseUrl(environment: Environment): string {
  const primary = environment.E2E_BASE_URL?.trim();
  const fallback = environment.PLAYWRIGHT_BASE_URL?.trim();
  const raw = primary || fallback;
  if (!raw) {
    throw new Error(
      'E2E_BASE_URL or PLAYWRIGHT_BASE_URL must point to a deployed test environment.',
    );
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('The Playwright base URL must be an absolute HTTP or HTTPS URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('The Playwright base URL must use HTTP or HTTPS.');
  }

  const hostname = url.hostname.toLowerCase();
  if (LOCAL_HOSTS.has(hostname) || hostname.endsWith('.localhost')) {
    throw new Error(
      'Playwright E2E requires an external deployed environment; local addresses are not allowed.',
    );
  }

  if (url.username || url.password) {
    throw new Error('The Playwright base URL must not contain credentials.');
  }

  url.hash = '';
  return url.toString().replace(/\/$/, '');
}
