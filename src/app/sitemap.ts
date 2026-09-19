import type { MetadataRoute } from 'next';
import { getPublicOpportunities } from '@/lib/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const opportunities = await getPublicOpportunities();
  return [
    { url: base, changeFrequency: 'daily', priority: 1 },
    ...opportunities
      .filter((opportunity) => !opportunity.isDemo && opportunity.status === 'published')
      .map((opportunity) => ({
        url: `${base}/convocatorias/${encodeURIComponent(opportunity.slug)}`,
        lastModified: opportunity.verifiedAt || opportunity.publishedAt,
        changeFrequency: 'daily' as const,
        priority: 0.8,
      })),
  ];
}
