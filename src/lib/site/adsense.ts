export const ADSENSE_CONSENT_EVENT = 'oportunia:ads-consent';
export const ADSENSE_SELLER_ID = 'f08c47fec0942fa0';

export type AdvertisingConsent = 'unknown' | 'denied' | 'granted';
export type AdPosition = 'catalog-end' | 'detail-body';

export type AdsenseConfig = {
  enabled: boolean;
  publisherId?: string;
  clientId?: string;
  slots: Partial<Record<AdPosition, string>>;
};

type Environment = Readonly<Record<string, string | undefined>>;

const PUBLISHER_ID_PATTERN = /^pub-\d{16}$/;
const SLOT_ID_PATTERN = /^\d{6,20}$/;

export function parseAdsenseConfig(environment: Environment = process.env): AdsenseConfig {
  const publisherId = environment.ADSENSE_PUBLISHER_ID?.trim();
  const publisherValid = !!publisherId && PUBLISHER_ID_PATTERN.test(publisherId);
  const catalogSlot = environment.ADSENSE_SLOT_CATALOG_END?.trim();
  const detailBodySlot = environment.ADSENSE_SLOT_DETAIL_BODY?.trim();
  const readinessConfirmed = environment.ADSENSE_READINESS_CONFIRMED === 'true';
  const enabled = environment.ADSENSE_ENABLED === 'true'
    && readinessConfirmed
    && publisherValid;

  return {
    enabled,
    publisherId: publisherValid ? publisherId : undefined,
    clientId: publisherValid ? `ca-${publisherId}` : undefined,
    slots: {
      ...(SLOT_ID_PATTERN.test(catalogSlot ?? '') ? { 'catalog-end': catalogSlot } : {}),
      ...(SLOT_ID_PATTERN.test(detailBodySlot ?? '') ? { 'detail-body': detailBodySlot } : {}),
    },
  };
}

export function canRenderAd(
  config: AdsenseConfig,
  consent: AdvertisingConsent,
  position: string,
): position is AdPosition {
  return (
    config.enabled &&
    consent === 'granted' &&
    (position === 'catalog-end' || position === 'detail-body') &&
    !!config.slots[position]
  );
}

export function parseConsentEvent(event: unknown): AdvertisingConsent {
  if (!event || typeof event !== 'object' || !('detail' in event)) return 'unknown';
  const detail = event.detail;
  if (!detail || typeof detail !== 'object' || !('status' in detail)) return 'unknown';
  return detail.status === 'granted' || detail.status === 'denied'
    ? detail.status
    : 'unknown';
}

export function buildAdsTxtResponse(config: AdsenseConfig): Response {
  if (!config.enabled || !config.publisherId) {
    return new Response(null, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return new Response(
    `google.com, ${config.publisherId}, DIRECT, ${ADSENSE_SELLER_ID}\n`,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
}
