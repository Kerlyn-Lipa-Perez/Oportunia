import type { MetadataRoute } from 'next';
import { getPublicOpportunities } from '@/lib/repository';
import { buildSitemapEntries, resolveSiteConfig } from '@/lib/site/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = resolveSiteConfig();
  if (!config.seoIndexingEnabled) return [];
  const opportunities = await getPublicOpportunities();
  return buildSitemapEntries(config, opportunities);
}
