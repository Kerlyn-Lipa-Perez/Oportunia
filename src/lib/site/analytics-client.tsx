"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useAdvertisingConsent } from "./adsense-client";
import {
  GA4_SCRIPT_ID,
  initializeGoogleAnalytics,
  synchronizeGoogleAnalyticsConsent,
  trackGoogleAnalyticsPageView,
  type AnalyticsRuntime,
  type GoogleAnalyticsConfig,
} from "./analytics";

declare global {
  interface Window extends AnalyticsRuntime {}
}

function GoogleAnalyticsTracker({ config }: { config: GoogleAnalyticsConfig }) {
  const consent = useAdvertisingConsent();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    if (!synchronizeGoogleAnalyticsConsent(window, config, consent)) return;
    if (consent !== "granted") return;
    if (!initializeGoogleAnalytics(window, config, consent)) return;

    const pagePath = search ? `${pathname}?${search}` : pathname;
    const pageLocation = new URL(pagePath, window.location.origin).toString();
    trackGoogleAnalyticsPageView(window, config, consent, pageLocation);
  }, [config.enabled, config.measurementId, consent, pathname, search]);

  if (consent !== "granted" || !config.enabled || !config.measurementId) return null;

  return <Script
    id={GA4_SCRIPT_ID}
    src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.measurementId)}`}
    strategy="afterInteractive"
  />;
}

export function GoogleAnalytics({ config }: { config: GoogleAnalyticsConfig }) {
  if (!config.enabled || !config.measurementId) return null;

  return <Suspense fallback={null}>
    <GoogleAnalyticsTracker config={config} />
  </Suspense>;
}
