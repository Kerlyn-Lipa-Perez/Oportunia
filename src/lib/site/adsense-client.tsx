"use client";

import Script from "next/script";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ADSENSE_CONSENT_EVENT,
  canRenderAd,
  parseConsentEvent,
  parseConsentPurposes,
  type AdPosition,
  type AdsenseConfig,
  type AdvertisingConsent,
  type ConsentPurposes,
} from "./adsense";

declare global {
  interface Window {
    __OPORTUNIA_AD_CONSENT__?: AdvertisingConsent;
    __OPORTUNIA_AD_PURPOSES__?: ConsentPurposes;
    adsbygoogle?: Array<Record<string, never>>;
  }
}

const AdsenseContext = createContext<{
  config: AdsenseConfig;
  consent: AdvertisingConsent;
  purposes?: ConsentPurposes;
}>({ config: { enabled: false, slots: {} }, consent: "unknown" });

export function useAdvertisingConsent(): AdvertisingConsent {
  return useContext(AdsenseContext).consent;
}

// GA4 follows analytics_storage only (design D3): the analytics hook derives
// from purposes, never from the ad_storage-projected status. Unknown until the
// CMP resolves purposes, so an ad-only grant can never activate analytics.
export function useAnalyticsConsent(): AdvertisingConsent {
  return useContext(AdsenseContext).purposes?.analytics_storage ?? "unknown";
}

export function useConsentPurposes(): ConsentPurposes | undefined {
  return useContext(AdsenseContext).purposes;
}

function purposesFromConsentEvent(event: Event): ConsentPurposes | undefined {
  const detail: unknown = (event as { detail?: unknown }).detail;
  if (!detail || typeof detail !== "object" || !("purposes" in detail)) return undefined;
  return parseConsentPurposes((detail as { purposes?: unknown }).purposes);
}

export function AdsenseProvider({
  config,
  children,
}: {
  config: AdsenseConfig;
  children: ReactNode;
}) {
  const [consent, setConsent] = useState<AdvertisingConsent>("unknown");
  const [purposes, setPurposes] = useState<ConsentPurposes | undefined>(undefined);

  useEffect(() => {
    const initial = window.__OPORTUNIA_AD_CONSENT__;
    if (initial === "granted" || initial === "denied") setConsent(initial);
    const initialPurposes = window.__OPORTUNIA_AD_PURPOSES__;
    if (initialPurposes) setPurposes(initialPurposes);

    const onConsent = (event: Event) => {
      const next = parseConsentEvent(event);
      window.__OPORTUNIA_AD_CONSENT__ = next;
      setConsent(next);
      // Fail closed: a malformed or purposes-less detail leaves purposes
      // unresolved, so every purpose gate stays shut.
      const parsed = purposesFromConsentEvent(event);
      window.__OPORTUNIA_AD_PURPOSES__ = parsed;
      setPurposes(parsed);
    };
    window.addEventListener(ADSENSE_CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(ADSENSE_CONSENT_EVENT, onConsent);
  }, []);

  return <AdsenseContext.Provider value={{ config, consent, purposes }}>
    {children}
  </AdsenseContext.Provider>;
}

export function AdsenseSlot({ position }: { position?: string }) {
  const { config, consent } = useContext(AdsenseContext);
  const initialized = useRef(false);
  const eligible = !!position && canRenderAd(config, consent, position);

  useEffect(() => {
    if (!eligible || initialized.current) return;
    initialized.current = true;
    try {
      (window.adsbygoogle ??= []).push({});
    } catch {
      initialized.current = false;
    }
  }, [eligible]);

  if (!eligible) return null;
  const slot = config.slots[position as AdPosition];

  return <>
    <Script
      id="oportunia-adsense"
      async
      crossOrigin="anonymous"
      strategy="afterInteractive"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.clientId}`}
    />
    <aside className="ad-slot" aria-label="Publicidad" data-ad-position={position}>
      <span>Publicidad</span>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={config.clientId}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  </>;
}
