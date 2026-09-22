import { buildAdsTxtResponse, parseAdsenseConfig } from '@/lib/site/adsense';

export function GET(): Response {
  return buildAdsTxtResponse(parseAdsenseConfig());
}
