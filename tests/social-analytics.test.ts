import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { AnonymousSessionRateLimiter, parseTrackableEventPayload } from '../src/lib/event-tracking';
import {
  aggregateSocialCampaignAnalytics,
  buildSocialAnalyticsReadModel,
  detectAnalyticsAnomalies,
  summarizeAnalyticsReadiness,
  type AnonymousAnalyticsEvent,
} from '../src/lib/social-analytics';

function event(overrides: Partial<AnonymousAnalyticsEvent> = {}): AnonymousAnalyticsEvent {
  return {
    name: 'landing_view',
    sessionId: '00000000-0000-4000-8000-000000000001',
    visitorId: null,
    engagementMs: null,
    utmContent: 'tt-video-1',
    opportunityId: 'opp-1',
    createdAt: '2026-09-01T12:00:00.000Z',
    ...overrides,
  };
}

test('event payload validation accepts bounded anonymous engagement and rejects persistent IDs without analytics consent', () => {
  assert.deepEqual(parseTrackableEventPayload({
    name: 'engagement',
    sessionId: '00000000-0000-4000-8000-000000000001',
    opportunityId: 'opp-1',
    content: 'tt-video-1',
    engagementMs: 15_000,
  }), {
    name: 'engagement',
    sessionId: '00000000-0000-4000-8000-000000000001',
    opportunityId: 'opp-1',
    content: 'tt-video-1',
    engagementMs: 15_000,
  });

  assert.equal(parseTrackableEventPayload({ name: 'engagement', sessionId: 'not-random', engagementMs: 15_000 }), null);
  assert.equal(parseTrackableEventPayload({ name: 'engagement', sessionId: '00000000-0000-4000-8000-000000000001', engagementMs: 60_001 }), null);
  assert.equal(parseTrackableEventPayload({ name: 'detail_view', sessionId: '00000000-0000-4000-8000-000000000001', engagementMs: 1_000 }), null);
  assert.equal(parseTrackableEventPayload({ name: 'official_click', opportunityId: 'opp-1' }), null);
  assert.equal(parseTrackableEventPayload({
    name: 'landing_view',
    sessionId: '00000000-0000-4000-8000-000000000001',
    visitorId: 'persistent-without-verifiable-consent',
  }), null);
});

test('server-side anonymous rate limiter bounds heartbeat bursts without using IP or browser data', () => {
  const limiter = new AnonymousSessionRateLimiter({ maximum: 4, windowMs: 60_000 });
  const sessionId = '00000000-0000-4000-8000-000000000001';
  for (let index = 0; index < 4; index += 1) assert.equal(limiter.accept(sessionId, index * 10_000), true);
  assert.equal(limiter.accept(sessionId, 40_000), false);
  assert.equal(limiter.accept(sessionId, 60_001), true);
});

test('campaign analytics groups anonymous sessions, bounces and detail engagement without inventing returning users', () => {
  const events: AnonymousAnalyticsEvent[] = [
    event(),
    event({ name: 'detail_view', createdAt: '2026-09-01T12:00:02.000Z' }),
    event({ name: 'engagement', engagementMs: 12_000, createdAt: '2026-09-01T12:00:14.000Z' }),
    event({ name: 'official_click', createdAt: '2026-09-01T12:00:15.000Z' }),
    event({ sessionId: '00000000-0000-4000-8000-000000000002', createdAt: '2026-09-02T12:00:00.000Z' }),
  ];

  const [row] = aggregateSocialCampaignAnalytics(events);
  assert.equal(row?.utmContent, 'tt-video-1');
  assert.equal(row?.sessions, 2);
  assert.equal(row?.bounces, 1);
  assert.equal(row?.averageDetailEngagementMs, 12_000);
  assert.equal(row?.officialClicks, 1);
  assert.equal(row?.returningVisitors, null);
  assert.equal(row?.anomaly.status, 'insufficient_data');
});

test('anomaly detector reports relative spikes, extremely short sessions and machine cadence only with enough data', () => {
  const sessions: AnonymousAnalyticsEvent[] = [];
  for (let day = 1; day <= 4; day += 1) {
    const count = day === 4 ? 30 : 5;
    for (let index = 0; index < count; index += 1) {
      const sessionId = `00000000-0000-4000-8000-${String(day * 1000 + index).padStart(12, '0')}`;
      sessions.push(event({ sessionId, createdAt: `2026-09-0${day}T12:${String(index).padStart(2, '0')}:00.000Z` }));
    }
  }
  const botSession = '00000000-0000-4000-8000-999999999999';
  for (let index = 0; index < 30; index += 1) {
    sessions.push(event({
      name: 'detail_view',
      sessionId: botSession,
      createdAt: new Date(Date.parse('2026-09-04T18:00:00.000Z') + index * 500).toISOString(),
    }));
  }

  const result = detectAnalyticsAnomalies(sessions);
  assert.equal(result.status, 'anomaly');
  assert.deepEqual(new Set(result.alerts.map((alert) => alert.code)), new Set([
    'traffic_spike',
    'short_session_ratio',
    'suspicious_cadence',
  ]));

  assert.equal(detectAnalyticsAnomalies(sessions.slice(0, 8)).status, 'insufficient_data');
  assert.deepEqual(detectAnalyticsAnomalies(sessions.slice(0, 8)).alerts, []);
});

test('readiness uses observed days and anomaly state while manual evidence remains explicitly unavailable', () => {
  const events = Array.from({ length: 14 }, (_, index) => event({
    sessionId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    createdAt: `2026-09-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
  }));
  const readiness = summarizeAnalyticsReadiness(events);
  assert.equal(readiness.measuredDays, 14);
  assert.equal(readiness.hasAnalyticsAnomaly, false);
  assert.equal(readiness.analyticsStatus, 'insufficient_data');

  const model = buildSocialAnalyticsReadModel(events);
  assert.equal(model.readiness.measuredDays, 14);
  assert.equal(model.readiness.manualEvidence.originalGuides, 'manual_evidence_required');
  assert.equal(model.readiness.manualEvidence.legal, 'manual_evidence_required');
  assert.equal(model.readiness.manualEvidence.seo, 'manual_evidence_required');
  assert.deepEqual(model.monetization, {
    status: 'pending_ga4_adsense_link',
    rpm: null,
    estimatedRevenue: null,
  });
});

test('privacy-first collection and admin UI are wired to the validated anonymous read model', () => {
  const tracker = readFileSync('src/components/attribution-tracker.tsx', 'utf8');
  const route = readFileSync('src/app/api/events/route.ts', 'utf8');
  const repository = readFileSync('src/lib/repository.ts', 'utf8');
  const admin = readFileSync('src/app/admin/social-campaigns.tsx', 'utf8');

  assert.match(tracker, /sessionStorage/);
  assert.match(tracker, /randomUUID/);
  assert.match(tracker, /sendAttributionEvent\('engagement'/);
  assert.doesNotMatch(tracker, /localStorage|userAgent|fingerprint|email/i);
  assert.match(route, /parseTrackableEventPayload/);
  assert.match(route, /AnonymousSessionRateLimiter/);
  for (const field of ['sessionId', 'visitorId', 'engagementMs']) assert.match(repository, new RegExp(field));
  assert.match(repository, /buildSocialAnalyticsReadModel/);
  for (const label of ['Sesiones', 'Rebotes', 'Tiempo medio en ficha', 'Fuente oficial']) {
    assert.match(admin, new RegExp(label));
  }
  assert.match(admin, /No bloquea publicaciones automáticamente/);
  assert.match(admin, /GA4.*AdSense/);
});
