import type { AdvertisingConsent } from './adsense';

export const GA4_SCRIPT_ID = 'oportunia-ga4';

export type GoogleAnalyticsConfig = {
  enabled: boolean;
  measurementId?: string;
};

export type AnalyticsRuntime = {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  __OPORTUNIA_GA4_INITIALIZED__?: string;
  __OPORTUNIA_GA4_CONSENT__?: 'denied' | 'granted';
  __OPORTUNIA_GA4_LAST_PAGE_VIEW__?: string;
  [key: `ga-disable-${string}`]: boolean | undefined;
};

type Environment = Readonly<Record<string, string | undefined>>;

const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{6,20}$/;

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
  consent: AdvertisingConsent,
): config is GoogleAnalyticsConfig & { measurementId: string } {
  return config.enabled
    && consent === 'granted'
    && !!config.measurementId
    && MEASUREMENT_ID_PATTERN.test(config.measurementId);
}

export function synchronizeGoogleAnalyticsConsent(
  runtime: AnalyticsRuntime,
  config: GoogleAnalyticsConfig,
  consent: AdvertisingConsent,
): boolean {
  const measurementId = config.measurementId;
  if (!config.enabled || !measurementId || !MEASUREMENT_ID_PATTERN.test(measurementId)) return false;

  const analyticsStorage = consent === 'granted' ? 'granted' : 'denied';
  try {
    runtime[`ga-disable-${measurementId}`] = analyticsStorage === 'denied';
    if (
      typeof runtime.gtag === 'function'
      && runtime.__OPORTUNIA_GA4_CONSENT__ !== analyticsStorage
    ) {
      runtime.gtag('consent', 'update', { analytics_storage: analyticsStorage });
      runtime.__OPORTUNIA_GA4_CONSENT__ = analyticsStorage;
    }
    return true;
  } catch {
    return false;
  }
}

export function initializeGoogleAnalytics(
  runtime: AnalyticsRuntime,
  config: GoogleAnalyticsConfig,
  consent: AdvertisingConsent,
): boolean {
  if (!canUseGoogleAnalytics(config, consent)) return false;
  if (!synchronizeGoogleAnalyticsConsent(runtime, config, consent)) return false;
  if (runtime.__OPORTUNIA_GA4_INITIALIZED__ === config.measurementId) return true;

  try {
    runtime.dataLayer ??= [];
    runtime.gtag ??= function gtag() {
      runtime.dataLayer?.push(arguments);
    };
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
  consent: AdvertisingConsent,
  pageLocation: string,
): boolean {
  if (!canUseGoogleAnalytics(config, consent)) return false;
  if (runtime.__OPORTUNIA_GA4_INITIALIZED__ !== config.measurementId) return false;
  if (typeof runtime.gtag !== 'function') return false;
  if (!synchronizeGoogleAnalyticsConsent(runtime, config, consent)) return false;

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
