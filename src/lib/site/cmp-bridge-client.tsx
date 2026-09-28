"use client";

import Script from "next/script";
import { useEffect } from "react";
import { ADSENSE_CONSENT_EVENT, type ConsentEventDetail } from "./adsense";
import { attachCmpListener, type CmpPayloadListener } from "./cmp-bridge";

declare global {
  interface Window {
    __tcfapi?: (
      command: string,
      version: number,
      callback: (data: unknown, success: boolean) => void,
    ) => void;
  }
}

function dispatchConsentDetail(detail: ConsentEventDetail): void {
  window.dispatchEvent(new CustomEvent(ADSENSE_CONSENT_EVENT, { detail }));
}

// --- Provisional extraction layer -----------------------------------------
// Console step 2 delivers the certified CMP snippet; only this file (the
// subscription hook and what is forwarded to translateCmpPayload) may need
// adjustment for the concrete payload shape. The pure translator seam in
// cmp-bridge.ts and its tests stay unchanged. Fail-closed: anything that is
// not resolvable is dropped by the translator, so consent stays unknown and
// every ad/analytics gate remains closed.
function subscribeCmpSource(listener: CmpPayloadListener): () => void {
  const tcfapi = window.__tcfapi;
  if (typeof tcfapi !== "function") return () => {};

  const onCmpEvent = (data: unknown, success: boolean) => {
    if (!success) return;
    listener(data);
  };

  try {
    tcfapi("addEventListener", 2, onCmpEvent);
  } catch {
    return () => {};
  }

  return () => {
    try {
      tcfapi("removeEventListener", 2, onCmpEvent);
    } catch {
      // The CMP is gone; nothing to detach.
    }
  };
}
// --- End provisional extraction layer -------------------------------------

export function CmpBridge() {
  useEffect(
    () => attachCmpListener(subscribeCmpSource, dispatchConsentDetail),
    [],
  );

  const cmpScriptSrc = process.env.NEXT_PUBLIC_CMP_SCRIPT_SRC?.trim();
  if (!cmpScriptSrc?.startsWith("https://")) return null;

  return (
    <Script
      id="oportunia-cmp"
      src={cmpScriptSrc}
      strategy="afterInteractive"
    />
  );
}
