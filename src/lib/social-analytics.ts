import type { TrackableEventName } from './types';

export interface AnonymousAnalyticsEvent {
  name: TrackableEventName;
  sessionId: string | null;
  visitorId: string | null;
  engagementMs: number | null;
  utmContent: string | null;
  opportunityId: string | null;
  createdAt: string;
}

export type AnalyticsAlertCode = 'traffic_spike' | 'short_session_ratio' | 'suspicious_cadence';

export interface AnalyticsAlert {
  code: AnalyticsAlertCode;
  severity: 'warning';
  message: string;
  observed: number;
  threshold: number;
}

export interface AnalyticsAnomalyAssessment {
  status: 'insufficient_data' | 'healthy' | 'anomaly';
  sampleSize: number;
  alerts: AnalyticsAlert[];
}

export interface SocialCampaignAnalyticsRow {
  utmContent: string;
  sessions: number;
  bounces: number;
  bounceRate: number | null;
  averageDetailEngagementMs: number | null;
  officialClicks: number;
  returningVisitors: number | null;
  firstEventAt: string | null;
  lastEventAt: string | null;
  anomaly: AnalyticsAnomalyAssessment;
}

export interface SocialAnalyticsReadModel {
  campaigns: SocialCampaignAnalyticsRow[];
  readiness: ReturnType<typeof summarizeAnalyticsReadiness> & {
    manualEvidence: {
      originalGuides: 'manual_evidence_required';
      legal: 'manual_evidence_required';
      seo: 'manual_evidence_required';
    };
  };
  monetization: {
    status: 'pending_ga4_adsense_link';
    rpm: null;
    estimatedRevenue: null;
  };
}

function timestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2 : sorted[middle] ?? 0;
}

/** Pure, conservative detector: small samples cannot produce alerts. */
export function detectAnalyticsAnomalies(input: readonly AnonymousAnalyticsEvent[]): AnalyticsAnomalyAssessment {
  const events = input.filter((item) => item.sessionId && timestamp(item.createdAt) !== null);
  const sessionIds = new Set(events.map((item) => item.sessionId as string));
  if (sessionIds.size < 20 || events.length < 30) {
    return { status: 'insufficient_data', sampleSize: sessionIds.size, alerts: [] };
  }

  const alerts: AnalyticsAlert[] = [];
  const dailySessions = new Map<string, Set<string>>();
  for (const item of events) {
    const date = item.createdAt.slice(0, 10);
    const sessions = dailySessions.get(date) ?? new Set<string>();
    sessions.add(item.sessionId as string);
    dailySessions.set(date, sessions);
  }
  const dailyCounts = [...dailySessions.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, sessions]) => sessions.size);
  if (dailyCounts.length >= 4) {
    const baseline = dailyCounts.slice(0, -1);
    const baselineAverage = baseline.reduce((sum, count) => sum + count, 0) / baseline.length;
    const latest = dailyCounts.at(-1) ?? 0;
    const spikeThreshold = Math.max(10, baselineAverage * 3);
    if (latest >= spikeThreshold) {
      alerts.push({
        code: 'traffic_spike',
        severity: 'warning',
        message: 'Pico de sesiones concentrado respecto del baseline disponible.',
        observed: latest,
        threshold: Math.ceil(spikeThreshold),
      });
    }
  }

  const bySession = new Map<string, AnonymousAnalyticsEvent[]>();
  for (const item of events) {
    const session = bySession.get(item.sessionId as string) ?? [];
    session.push(item);
    bySession.set(item.sessionId as string, session);
  }
  let shortSessions = 0;
  let suspiciousCadence = false;
  for (const session of bySession.values()) {
    const times = session.map((item) => timestamp(item.createdAt)).filter((value): value is number => value !== null).sort((left, right) => left - right);
    const engagement = session.reduce((sum, item) => sum + (item.engagementMs ?? 0), 0);
    const elapsed = (times.at(-1) ?? 0) - (times[0] ?? 0);
    if (Math.max(elapsed, engagement) < 1_500) shortSessions += 1;

    const activityTimes = session
      .filter((item) => item.name !== 'engagement')
      .map((item) => timestamp(item.createdAt))
      .filter((value): value is number => value !== null)
      .sort((left, right) => left - right);
    if (activityTimes.length >= 20) {
      const intervals = activityTimes.slice(1).map((value, index) => value - (activityTimes[index] ?? value));
      const middle = median(intervals);
      const uniformRatio = intervals.filter((interval) => Math.abs(interval - middle) <= 25).length / intervals.length;
      if (middle <= 2_000 && uniformRatio >= 0.8) suspiciousCadence = true;
    }
  }

  const shortRatio = shortSessions / bySession.size;
  if (shortRatio >= 0.7) {
    alerts.push({
      code: 'short_session_ratio',
      severity: 'warning',
      message: 'Proporción inusualmente alta de sesiones extremadamente cortas.',
      observed: Number(shortRatio.toFixed(3)),
      threshold: 0.7,
    });
  }
  if (suspiciousCadence) {
    alerts.push({
      code: 'suspicious_cadence',
      severity: 'warning',
      message: 'Cadencia repetitiva de eventos compatible con tráfico automatizado.',
      observed: 1,
      threshold: 1,
    });
  }

  return {
    status: alerts.length ? 'anomaly' : 'healthy',
    sampleSize: sessionIds.size,
    alerts,
  };
}

export function aggregateSocialCampaignAnalytics(input: readonly AnonymousAnalyticsEvent[]): SocialCampaignAnalyticsRow[] {
  const grouped = new Map<string, AnonymousAnalyticsEvent[]>();
  for (const item of input) {
    if (!item.utmContent || !item.sessionId) continue;
    const group = grouped.get(item.utmContent) ?? [];
    group.push(item);
    grouped.set(item.utmContent, group);
  }

  return [...grouped.entries()].map(([utmContent, events]) => {
    const bySession = new Map<string, AnonymousAnalyticsEvent[]>();
    for (const item of events) {
      const session = bySession.get(item.sessionId as string) ?? [];
      session.push(item);
      bySession.set(item.sessionId as string, session);
    }

    let bounces = 0;
    const detailEngagement: number[] = [];
    for (const session of bySession.values()) {
      const views = session.filter((item) => item.name === 'landing_view' || item.name === 'detail_view' || item.name === 'view');
      const engagement = session.reduce((sum, item) => sum + (item.engagementMs ?? 0), 0);
      const officialClicks = session.filter((item) => item.name === 'official_click').length;
      if (views.length === 1 && engagement < 5_000 && officialClicks === 0) bounces += 1;
      if (session.some((item) => item.name === 'detail_view')) detailEngagement.push(engagement);
    }

    const visitorSessions = new Map<string, Set<string>>();
    for (const item of events) {
      if (!item.visitorId) continue;
      const sessions = visitorSessions.get(item.visitorId) ?? new Set<string>();
      sessions.add(item.sessionId as string);
      visitorSessions.set(item.visitorId, sessions);
    }
    const validTimes = events.map((item) => item.createdAt).filter((value) => timestamp(value) !== null).sort();
    const sessions = bySession.size;
    return {
      utmContent,
      sessions,
      bounces,
      bounceRate: sessions ? bounces / sessions : null,
      averageDetailEngagementMs: detailEngagement.length
        ? Math.round(detailEngagement.reduce((sum, value) => sum + value, 0) / detailEngagement.length)
        : null,
      officialClicks: events.filter((item) => item.name === 'official_click').length,
      returningVisitors: visitorSessions.size
        ? [...visitorSessions.values()].filter((visitorSessionIds) => visitorSessionIds.size > 1).length
        : null,
      firstEventAt: validTimes[0] ?? null,
      lastEventAt: validTimes.at(-1) ?? null,
      anomaly: detectAnalyticsAnomalies(events),
    };
  }).sort((left, right) => (right.lastEventAt ?? '').localeCompare(left.lastEventAt ?? ''));
}

export function summarizeAnalyticsReadiness(input: readonly AnonymousAnalyticsEvent[]) {
  const measuredDays = new Set(input.filter((item) => timestamp(item.createdAt) !== null).map((item) => item.createdAt.slice(0, 10))).size;
  const assessment = detectAnalyticsAnomalies(input);
  return {
    measuredDays,
    hasAnalyticsAnomaly: assessment.status === 'anomaly',
    analyticsStatus: assessment.status,
    alerts: assessment.alerts,
  };
}

/**
 * Build the complete admin read model without filling operational evidence or
 * monetization data that the event stream cannot prove.
 */
export function buildSocialAnalyticsReadModel(input: readonly AnonymousAnalyticsEvent[]): SocialAnalyticsReadModel {
  return {
    campaigns: aggregateSocialCampaignAnalytics(input),
    readiness: {
      ...summarizeAnalyticsReadiness(input),
      manualEvidence: {
        originalGuides: 'manual_evidence_required',
        legal: 'manual_evidence_required',
        seo: 'manual_evidence_required',
      },
    },
    monetization: {
      status: 'pending_ga4_adsense_link',
      rpm: null,
      estimatedRevenue: null,
    },
  };
}
