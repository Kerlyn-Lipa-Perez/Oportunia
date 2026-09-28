export const ADSENSE_CONSENT_EVENT = 'oportunia:ads-consent';
export const ADSENSE_SELLER_ID = 'f08c47fec0942fa0';

export type AdvertisingConsent = 'unknown' | 'denied' | 'granted';
export type AdPosition = 'catalog-end' | 'detail-body';

export type ConsentPurpose = 'granted' | 'denied';

export type ConsentPurposes = {
  analytics_storage: ConsentPurpose;
  ad_storage: ConsentPurpose;
  ad_user_data: ConsentPurpose;
  ad_personalization: ConsentPurpose;
};

// Per design D2 the pinned { status } contract is extended, never replaced:
// status stays a projection of purposes.ad_storage, so parseConsentEvent and
// its site-foundation assertions remain valid unchanged.
export type ConsentEventDetail = {
  status: ConsentPurpose;
  purposes: ConsentPurposes;
};

const CONSENT_PURPOSE_KEYS = [
  'analytics_storage',
  'ad_storage',
  'ad_user_data',
  'ad_personalization',
] as const;

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

export function buildConsentDetail(purposes: ConsentPurposes): ConsentEventDetail {
  return { status: purposes.ad_storage, purposes };
}

export function parseConsentPurposes(value: unknown): ConsentPurposes | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const purposes: Partial<Record<(typeof CONSENT_PURPOSE_KEYS)[number], ConsentPurpose>> = {};
  for (const key of CONSENT_PURPOSE_KEYS) {
    const purpose = record[key];
    if (purpose !== 'granted' && purpose !== 'denied') return undefined;
    purposes[key] = purpose;
  }
  return purposes as ConsentPurposes;
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
