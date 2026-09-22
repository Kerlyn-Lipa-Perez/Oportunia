'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';

type AttributionEventName = 'landing_view' | 'detail_view';
type AnonymousEventName = AttributionEventName | 'official_click' | 'engagement';
const sessionStorageKey = 'oportunia:analytics-session';
const opaqueSessionId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const heartbeatMs = 15_000;

function anonymousSessionId(): string | undefined {
  try {
    const current = window.sessionStorage.getItem(sessionStorageKey);
    if (current && opaqueSessionId.test(current)) return current;
    const created = window.crypto.randomUUID();
    window.sessionStorage.setItem(sessionStorageKey, created);
    return created;
  } catch {
    return undefined;
  }
}

function sendAttributionEvent(name: AnonymousEventName, opportunityId?: string, engagementMs?: number) {
  const sessionId = anonymousSessionId();
  if (!sessionId) return;
  const params = new URLSearchParams(window.location.search);
  const content = params.get('utm_content') || undefined;
  void fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      opportunityId,
      source: params.get('utm_source') || undefined,
      medium: params.get('utm_medium') || undefined,
      campaign: params.get('utm_campaign') || undefined,
      content,
      sessionId,
      engagementMs,
    }),
    keepalive: true,
  }).catch(() => {});
}

export function AttributionTracker({
  name,
  opportunityId,
  opportunityIdByContent,
}: {
  name: AttributionEventName;
  opportunityId?: string;
  opportunityIdByContent?: Record<string, string>;
}) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const content = params.get('utm_content') || undefined;
    const attributedOpportunityId = opportunityId || (content ? opportunityIdByContent?.[content] : undefined);
    sendAttributionEvent(name, attributedOpportunityId);

    if (name !== 'detail_view' || !attributedOpportunityId) return;
    let visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
    const flushEngagement = () => {
      if (visibleSince === null) return;
      const now = Date.now();
      const elapsed = Math.min(60_000, now - visibleSince);
      visibleSince = now;
      if (elapsed >= 250) {
        sendAttributionEvent('engagement', attributedOpportunityId, elapsed);
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushEngagement();
        visibleSince = null;
      } else {
        visibleSince = Date.now();
      }
    };
    const interval = window.setInterval(flushEngagement, heartbeatMs);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flushEngagement);
    return () => {
      flushEngagement();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flushEngagement);
    };
  }, [name, opportunityId, opportunityIdByContent]);

  return null;
}

export function AttributedOfficialAnchor({
  opportunityId,
  url,
  children,
}: {
  opportunityId: string;
  url: string;
  children: ReactNode;
}) {
  return <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => sendAttributionEvent('official_click', opportunityId)}>{children}</a>;
}
