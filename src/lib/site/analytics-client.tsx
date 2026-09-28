"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useAnalyticsConsent, useConsentPurposes } from "./adsense-client";
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
  const consent = useAnalyticsConsent();
  const purposes = useConsentPurposes();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    // Unresolved purposes (CMP not decided) keep every GA4 gate closed.
    if (!purposes) return;
    if (!synchronizeGoogleAnalyticsConsent(window, config, purposes)) return;
    // GA4 follows analytics_storage only — an ad_storage grant never loads it.
    if (consent !== "granted") return;
    if (!initializeGoogleAnalytics(window, config, purposes)) return;

    const pagePath = search ? `${pathname}?${search}` : pathname;
    const pageLocation = new URL(pagePath, window.location.origin).toString();
    trackGoogleAnalyticsPageView(window, config, purposes, pageLocation);
  }, [config.enabled, config.measurementId, consent, purposes, pathname, search]);

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
