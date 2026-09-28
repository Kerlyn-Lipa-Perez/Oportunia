// Pure, DOM-free CMP translation layer (design D4): the certified CMP payload
// is mapped here, and only the thin client wiring in cmp-bridge-client.tsx may
// adapt to the concrete snippet (console step 2). No window/document access.

import {
  buildConsentDetail,
  parseConsentPurposes,
  type ConsentEventDetail,
} from './adsense';

export type CmpPayloadListener = (payload: unknown) => void;

// Dependency-injection seam: a CMP event source registers one listener and
// optionally returns an unsubscribe. Sources are injected (fake-able) so the
// seam is testable without a DOM.
export type CmpSource = (listener: CmpPayloadListener) => void | (() => void);

export type CmpSink = (detail: ConsentEventDetail) => void;

type CmpDecision = 'accept' | 'reject' | 'revoke';

const CMP_DECISION_KEYS = ['decision', 'action'] as const;
const CMP_DECISIONS: readonly CmpDecision[] = ['accept', 'reject', 'revoke'];

const ALL_GRANTED = {
  analytics_storage: 'granted',
  ad_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
} as const;

const ALL_DENIED = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isCmpDecision(value: unknown): value is CmpDecision {
  return typeof value === 'string' && (CMP_DECISIONS as readonly string[]).includes(value);
}

/**
 * Translate a CMP payload into the app consent detail.
 *
 * - explicit accept decision  -> all four purposes granted
 * - explicit reject/revoke    -> all four purposes denied
 * - granular 4-purpose payload -> used as-is (status := ad_storage)
 * - anything malformed or unresolved -> null (nothing is dispatched, gates
 *   stay closed: consent remains unknown)
 */
export function translateCmpPayload(payload: unknown): ConsentEventDetail | null {
  if (!isRecord(payload)) return null;

  const hasDecisionKey = CMP_DECISION_KEYS.some((key) => key in payload);
  if (hasDecisionKey) {
    const raw: unknown = 'decision' in payload ? payload.decision : payload.action;
    if (raw === 'accept') return buildConsentDetail({ ...ALL_GRANTED });
    if (isCmpDecision(raw)) return buildConsentDetail({ ...ALL_DENIED });
    // An explicit but unknown decision never falls through to purposes.
    return null;
  }

  const purposes = parseConsentPurposes(payload);
  return purposes ? buildConsentDetail(purposes) : null;
}

/**
 * Subscribe to a CMP source and forward only translated (resolvable) details
 * to the sink. Malformed/unresolved payloads never reach the sink. Returns a
 * detach function that delegates to the source unsubscribe when provided.
 */
export function attachCmpListener(source: CmpSource, sink: CmpSink): () => void {
  let detach: void | (() => void);
  try {
    detach = source((payload: unknown) => {
      const detail = translateCmpPayload(payload);
      if (detail) sink(detail);
    });
  } catch {
    detach = undefined;
  }
  return typeof detach === 'function' ? detach : () => {};
}
