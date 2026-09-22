"use client";

import Script from "next/script";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ADSENSE_CONSENT_EVENT,
  canRenderAd,
  parseConsentEvent,
  type AdPosition,
  type AdsenseConfig,
  type AdvertisingConsent,
} from "./adsense";

declare global {
  interface Window {
    __OPORTUNIA_AD_CONSENT__?: AdvertisingConsent;
    adsbygoogle?: Array<Record<string, never>>;
  }
}

const AdsenseContext = createContext<{
  config: AdsenseConfig;
  consent: AdvertisingConsent;
}>({ config: { enabled: false, slots: {} }, consent: "unknown" });

export function useAdvertisingConsent(): AdvertisingConsent {
  return useContext(AdsenseContext).consent;
}

export function AdsenseProvider({
  config,
  children,
}: {
  config: AdsenseConfig;
  children: ReactNode;
}) {
  const [consent, setConsent] = useState<AdvertisingConsent>("unknown");

  useEffect(() => {
    const initial = window.__OPORTUNIA_AD_CONSENT__;
    if (initial === "granted" || initial === "denied") setConsent(initial);

    const onConsent = (event: Event) => {
      const next = parseConsentEvent(event);
      window.__OPORTUNIA_AD_CONSENT__ = next;
      setConsent(next);
    };
    window.addEventListener(ADSENSE_CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(ADSENSE_CONSENT_EVENT, onConsent);
  }, []);

  return <AdsenseContext.Provider value={{ config, consent }}>
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
