import type { MetadataRoute } from 'next';

export const LEGAL_CONTENT_LAST_MODIFIED = '2026-09-20';

type Environment = Readonly<Record<string, string | undefined>>;

export type SiteConfig = {
  url: string;
  isProduction: boolean;
  seoIndexingEnabled: boolean;
  contactEmail?: string;
};

type SitemapOpportunity = {
  slug: string;
  status: string;
  isDemo: boolean;
  verifiedAt?: string;
  publishedAt?: string;
};

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

function normalizedUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined;
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
}

export function isPublicHttpsOrigin(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !LOCAL_HOSTNAMES.has(url.hostname)
    );
  } catch {
    return false;
  }
}

function validContactEmail(value: string | undefined): string | undefined {
  const email = value?.trim();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

export function resolveSiteConfig(environment: Environment = process.env): SiteConfig {
  const isProduction = environment.NODE_ENV === 'production';
  const configuredUrl = normalizedUrl(environment.NEXT_PUBLIC_SITE_URL);

  return {
    url: configuredUrl ?? 'http://localhost:3000',
    isProduction,
    seoIndexingEnabled:
      isProduction &&
      isPublicHttpsOrigin(configuredUrl) &&
      environment.SEO_INDEXING_ENABLED === 'true',
    contactEmail: validContactEmail(environment.NEXT_PUBLIC_CONTACT_EMAIL),
  };
}

export function buildRobots(config: SiteConfig): MetadataRoute.Robots {
  if (!config.seoIndexingEnabled) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/'],
    },
    sitemap: `${config.url}/sitemap.xml`,
    host: config.url,
  };
}

function routeUrl(base: string, path: string): string {
  return path === '/' ? base : `${base}${path}`;
}

function realModifiedDate(opportunity: SitemapOpportunity): string | undefined {
  return [opportunity.verifiedAt, opportunity.publishedAt].find(
    (value): value is string => !!value && Number.isFinite(Date.parse(value)),
  );
}

export function buildSitemapEntries(
  config: SiteConfig,
  opportunities: readonly SitemapOpportunity[],
): MetadataRoute.Sitemap {
  if (!config.seoIndexingEnabled) return [];

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: routeUrl(config.url, '/'), changeFrequency: 'daily', priority: 1 },
    { url: routeUrl(config.url, '/como-funciona'), changeFrequency: 'monthly', priority: 0.7 },
    { url: routeUrl(config.url, '/nosotros'), changeFrequency: 'monthly', priority: 0.6 },
    { url: routeUrl(config.url, '/contacto'), changeFrequency: 'monthly', priority: 0.5 },
    ...['/privacidad', '/cookies', '/terminos'].map((path) => ({
      url: routeUrl(config.url, path),
      lastModified: LEGAL_CONTENT_LAST_MODIFIED,
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    })),
  ];

  const opportunityRoutes: MetadataRoute.Sitemap = opportunities
    .filter((opportunity) => opportunity.status === 'published' && !opportunity.isDemo)
    .map((opportunity) => ({
      url: routeUrl(config.url, `/convocatorias/${encodeURIComponent(opportunity.slug)}`),
      lastModified: realModifiedDate(opportunity),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));

  return [...staticRoutes, ...opportunityRoutes];
}
