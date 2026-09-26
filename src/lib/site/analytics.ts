import type { ConsentPurposes } from './adsense';

export const GA4_SCRIPT_ID = 'oportunia-ga4';

export type GoogleAnalyticsConfig = {
  enabled: boolean;
  measurementId?: string;
};

export type AnalyticsRuntime = {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  __OPORTUNIA_GA4_INITIALIZED__?: string;
  __OPORTUNIA_GA4_CONSENT__?: string;
  __OPORTUNIA_GA4_LAST_PAGE_VIEW__?: string;
  [key: `ga-disable-${string}`]: boolean | undefined;
};

type Environment = Readonly<Record<string, string | undefined>>;

const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{6,20}$/;

// Stable ordering for the Consent Mode v2 dedupe tuple (design D3).
const CONSENT_SIGNAL_ORDER = [
  'analytics_storage',
  'ad_storage',
  'ad_user_data',
  'ad_personalization',
] as const;

function consentTuple(purposes: ConsentPurposes): string {
  return CONSENT_SIGNAL_ORDER.map((signal) => purposes[signal]).join('|');
}

export function parseGoogleAnalyticsConfig(
  environment: Environment = process.env,
): GoogleAnalyticsConfig {
  const measurementId = environment.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  if (!measurementId || !MEASUREMENT_ID_PATTERN.test(measurementId)) {
    return { enabled: false };
  }

  return { enabled: true, measurementId };
}

function canUseGoogleAnalytics(
  config: GoogleAnalyticsConfig,
  purposes: ConsentPurposes,
): config is GoogleAnalyticsConfig & { measurementId: string } {
  return config.enabled
    && purposes.analytics_storage === 'granted'
    && !!config.measurementId
    && MEASUREMENT_ID_PATTERN.test(config.measurementId);
}

export function synchronizeGoogleAnalyticsConsent(
  runtime: AnalyticsRuntime,
  config: GoogleAnalyticsConfig,
  purposes: ConsentPurposes,
): boolean {
  const measurementId = config.measurementId;
  if (!config.enabled || !measurementId || !MEASUREMENT_ID_PATTERN.test(measurementId)) return false;

  try {
    // Design D3: the GA4 disable flag tracks analytics_storage only, so an
    // ad_storage grant never activates analytics and vice versa.
    runtime[`ga-disable-${measurementId}`] = purposes.analytics_storage === 'denied';
    const consentKey = consentTuple(purposes);
    if (
      typeof runtime.gtag === 'function'
      && runtime.__OPORTUNIA_GA4_CONSENT__ !== consentKey
    ) {
      // All four Consent Mode v2 signals on every consent change, including revoke.
      runtime.gtag('consent', 'update', purposes);
      runtime.__OPORTUNIA_GA4_CONSENT__ = consentKey;
    }
    return true;
  } catch {
    return false;
  }
}

export function initializeGoogleAnalytics(
  runtime: AnalyticsRuntime,
  config: GoogleAnalyticsConfig,
  purposes: ConsentPurposes,
): boolean {
  if (!canUseGoogleAnalytics(config, purposes)) return false;

  try {
    // Design D3 init order: dataLayer/gtag stub -> consent update -> js -> config,
    // so the consent state is queued before gtag initialization reads it.
    runtime.dataLayer ??= [];
    runtime.gtag ??= function gtag() {
      runtime.dataLayer?.push(arguments);
    };
    if (!synchronizeGoogleAnalyticsConsent(runtime, config, purposes)) return false;
    if (runtime.__OPORTUNIA_GA4_INITIALIZED__ === config.measurementId) return true;

    runtime.gtag('js', new Date());
    runtime.gtag('config', config.measurementId, { send_page_view: false });
    runtime.__OPORTUNIA_GA4_INITIALIZED__ = config.measurementId;
    return true;
  } catch {
    return false;
  }
}

export function trackGoogleAnalyticsPageView(
  runtime: AnalyticsRuntime,
  config: GoogleAnalyticsConfig,
  purposes: ConsentPurposes,
  pageLocation: string,
): boolean {
  if (!canUseGoogleAnalytics(config, purposes)) return false;
  if (runtime.__OPORTUNIA_GA4_INITIALIZED__ !== config.measurementId) return false;
  if (typeof runtime.gtag !== 'function') return false;
  if (!synchronizeGoogleAnalyticsConsent(runtime, config, purposes)) return false;

  let url: URL;
  try {
    url = new URL(pageLocation);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  } catch {
    return false;
  }

  const normalizedLocation = url.toString();
  const pageViewKey = `${config.measurementId}:${normalizedLocation}`;
  if (runtime.__OPORTUNIA_GA4_LAST_PAGE_VIEW__ === pageViewKey) return false;

  try {
    runtime.gtag('event', 'page_view', {
      page_location: normalizedLocation,
      page_path: `${url.pathname}${url.search}`,
    });
    runtime.__OPORTUNIA_GA4_LAST_PAGE_VIEW__ = pageViewKey;
    return true;
  } catch {
    return false;
  }
}
