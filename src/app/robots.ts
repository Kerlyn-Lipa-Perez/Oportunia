import type { MetadataRoute } from 'next';
import { buildRobots, resolveSiteConfig } from '@/lib/site/config';

export default function robots(): MetadataRoute.Robots {
  return buildRobots(resolveSiteConfig());
}
