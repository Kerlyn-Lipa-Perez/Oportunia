import { isTrackableEventName, type TrackableEventName } from './types';

const opaqueSessionId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const textFields = ['opportunityId', 'source', 'medium', 'campaign', 'content'] as const;

export interface TrackableEventPayload {
  name: TrackableEventName;
  opportunityId?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  sessionId?: string;
  engagementMs?: number;
}

/**
 * Validate the complete public analytics contract. Persistent visitor IDs are
 * intentionally rejected until the server can verify analytics-specific consent.
 */
export function parseTrackableEventPayload(value: unknown): TrackableEventPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (!isTrackableEventName(input.name)) return null;
  if ('visitorId' in input) return null;

  const result: TrackableEventPayload = { name: input.name };
  for (const field of textFields) {
    const candidate = input[field];
    if (candidate === undefined) continue;
    if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 160) return null;
    result[field] = candidate;
  }

  if (input.sessionId !== undefined) {
    if (typeof input.sessionId !== 'string' || !opaqueSessionId.test(input.sessionId)) return null;
    result.sessionId = input.sessionId;
  }

  const sessionRequired = input.name === 'landing_view'
    || input.name === 'detail_view'
    || input.name === 'official_click'
    || input.name === 'engagement';
  if (sessionRequired && !result.sessionId) return null;

  if (input.name === 'engagement') {
    if (!result.opportunityId || !Number.isInteger(input.engagementMs)) return null;
    const engagementMs = input.engagementMs as number;
    if (engagementMs < 250 || engagementMs > 60_000) return null;
    result.engagementMs = engagementMs;
  } else if (input.engagementMs !== undefined) {
    return null;
  }

  return result;
}

export class AnonymousSessionRateLimiter {
  private readonly accepted = new Map<string, number[]>();
  private readonly maximum: number;
  private readonly windowMs: number;
  private readonly maximumSessions: number;

  constructor(options: { maximum?: number; windowMs?: number; maximumSessions?: number } = {}) {
    this.maximum = options.maximum ?? 8;
    this.windowMs = options.windowMs ?? 60_000;
    this.maximumSessions = options.maximumSessions ?? 5_000;
  }

  accept(sessionId: string, now = Date.now()): boolean {
    const recent = (this.accepted.get(sessionId) ?? []).filter((timestamp) => now - timestamp < this.windowMs);
    if (recent.length >= this.maximum) {
      this.accepted.set(sessionId, recent);
      return false;
    }
    if (!this.accepted.has(sessionId) && this.accepted.size >= this.maximumSessions) {
      const oldestKey = this.accepted.keys().next().value as string | undefined;
      if (oldestKey) this.accepted.delete(oldestKey);
    }
    recent.push(now);
    this.accepted.set(sessionId, recent);
    return true;
  }
}
