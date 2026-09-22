import { randomUUID } from 'node:crypto';
import { and, desc, eq, gte, inArray, isNotNull, lte, ne } from 'drizzle-orm';
import { buildSocialAnalyticsReadModel, type AnonymousAnalyticsEvent } from './social-analytics';
import type { Opportunity, SocialCampaign, SocialCampaignStatus } from './types';
import { getDeadline, isPublicOpportunity } from './opportunities';
import { db } from './db';
import {
  appProfiles,
  approvedSources,
  events,
  ingestionRuns,
  opportunities,
  opportunityProvenance,
  socialCampaigns,
} from './db/schema';
import { normalizeOfficialUrl, type IngestionProvenanceInput, type IngestionSourceKind } from './ingestion/rows';

export async function getAllOpportunities(): Promise<Opportunity[]> {
  const rows = await db.select().from(opportunities);
  return rows.map((row) => JSON.parse(row.data) as Opportunity);
}

export async function getPublicOpportunities(): Promise<Opportunity[]> {
  const all = await getAllOpportunities();
  return all
    .filter((item) => isPublicOpportunity(item))
    .map((item) => ({
      ...item,
      status: getDeadline(item.closingDate).closed
        ? ('closed' as const)
        : item.status === 'scheduled'
          ? ('published' as const)
          : item.status,
    }));
}

export async function getOpportunityBySlug(slug: string): Promise<Opportunity | undefined> {
  const all = await getPublicOpportunities();
  return all.find((item) => item.slug === slug);
}

export async function getOpportunityById(id: string): Promise<Opportunity | undefined> {
  const all = await getAllOpportunities();
  return all.find((item) => item.id === id);
}

export async function saveOpportunity(opportunity: Opportunity): Promise<Opportunity> {
  await db
    .insert(opportunities)
    .values({
      id: opportunity.id,
      slug: opportunity.slug,
      data: JSON.stringify(opportunity),
    })
    .onConflictDoUpdate({
      target: opportunities.id,
      set: { slug: opportunity.slug, data: JSON.stringify(opportunity) },
    });
  return opportunity;
}

export async function recordEvent(data: {
  name: string;
  opportunityId?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  sessionId?: string;
  engagementMs?: number;
}): Promise<void> {
  const clean = (value?: string) => (value || '').slice(0, 160);
  await db.insert(events).values({
    id: randomUUID(),
    name: clean(data.name),
    opportunityId: clean(data.opportunityId),
    source: clean(data.source),
    medium: clean(data.medium),
    campaign: clean(data.campaign),
    content: clean(data.content),
    sessionId: data.sessionId,
    engagementMs: data.engagementMs,
    createdAt: new Date().toISOString(),
  });
}

export type ApplicationRole = 'admin' | 'editor';

export async function getAppProfileRole(userId: string): Promise<ApplicationRole | null> {
  const [profile] = await db.select({ role: appProfiles.role }).from(appProfiles).where(eq(appProfiles.userId, userId)).limit(1);
  return profile?.role === 'admin' || profile?.role === 'editor' ? profile.role : null;
}

export async function saveAppProfile(input: { userId: string; role: ApplicationRole }): Promise<void> {
  const now = new Date().toISOString();
  await db.insert(appProfiles).values({ ...input, createdAt: now, updatedAt: now }).onConflictDoUpdate({
    target: appProfiles.userId,
    set: { role: input.role, updatedAt: now },
  });
}

export interface ApprovedSourceInput {
  id?: string;
  name: string;
  url: string;
  kind: IngestionSourceKind;
  enabled?: boolean;
}

export async function saveApprovedSource(input: ApprovedSourceInput) {
  const now = new Date().toISOString();
  const source = {
    id: input.id ?? randomUUID(),
    name: input.name.trim(),
    url: input.url.trim(),
    kind: input.kind,
    enabled: input.enabled ?? false,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(approvedSources).values(source).onConflictDoUpdate({
    target: approvedSources.id,
    set: { name: source.name, url: source.url, kind: source.kind, enabled: source.enabled, updatedAt: now },
  });
  return source;
}

export async function getApprovedSources() {
  return db.select().from(approvedSources).orderBy(approvedSources.name);
}

export type IngestionTrigger = 'cron' | 'manual' | 'excel';
export type IngestionRunStatus = 'running' | 'completed' | 'failed';

export interface StartIngestionRunInput {
  id?: string;
  sourceId?: string;
  trigger: IngestionTrigger;
}

export async function startIngestionRun(input: StartIngestionRunInput) {
  const run = {
    id: input.id ?? randomUUID(),
    sourceId: input.sourceId ?? null,
    trigger: input.trigger,
    status: 'running' as const,
    importedCount: 0,
    invalidCount: 0,
    duplicateCount: 0,
    error: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
  await db.insert(ingestionRuns).values(run);
  return run;
}

export async function completeIngestionRun(input: {
  id: string;
  status: Exclude<IngestionRunStatus, 'running'>;
  importedCount: number;
  invalidCount: number;
  duplicateCount: number;
  error?: string;
}): Promise<void> {
  await db.update(ingestionRuns).set({
    status: input.status,
    importedCount: input.importedCount,
    invalidCount: input.invalidCount,
    duplicateCount: input.duplicateCount,
    error: input.error ?? null,
    completedAt: new Date().toISOString(),
  }).where(eq(ingestionRuns.id, input.id));
}

export async function getIngestionHistory(limit = 50) {
  return db.select().from(ingestionRuns).orderBy(desc(ingestionRuns.startedAt)).limit(Math.min(Math.max(limit, 1), 100));
}

export async function findExistingNormalizedOfficialUrls(urls: Iterable<string>): Promise<Set<string>> {
  const normalized = [...new Set([...urls].map((url) => normalizeOfficialUrl(url)).filter((url): url is string => !!url))];
  if (normalized.length === 0) return new Set();
  const rows = await db.select({ normalizedOfficialUrl: opportunityProvenance.normalizedOfficialUrl })
    .from(opportunityProvenance)
    .where(inArray(opportunityProvenance.normalizedOfficialUrl, normalized));
  return new Set(rows.map((row) => row.normalizedOfficialUrl));
}

export interface CreateIngestedDraftInput {
  opportunity: Omit<Opportunity, 'id' | 'slug'>;
  provenance: IngestionProvenanceInput & {
    originalOfficialUrl: string;
    normalizedOfficialUrl: string;
  };
}

export type CreateIngestedDraftResult =
  | { created: true; opportunity: Opportunity }
  | { created: false; reason: 'duplicate'; existingOpportunityId?: string };

function draftSlug(opportunity: Pick<Opportunity, 'entity' | 'title'>, id: string): string {
  const base = `${opportunity.entity}-${opportunity.title}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'oportunidad';
  return `${base}-${id.slice(0, 8)}`;
}

/** Persist an imported record as a draft and atomically reserve its normalized official URL. */
export async function createIngestedDraft(input: CreateIngestedDraftInput): Promise<CreateIngestedDraftResult> {
  const id = randomUUID();
  const opportunity: Opportunity = {
    ...input.opportunity,
    id,
    slug: draftSlug(input.opportunity, id),
    status: 'draft',
    verifiedAt: '',
    verifiedBy: '',
    publishedAt: '',
    isDemo: false,
    featured: false,
  };

  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ opportunityId: opportunityProvenance.opportunityId })
      .from(opportunityProvenance)
      .where(eq(opportunityProvenance.normalizedOfficialUrl, input.provenance.normalizedOfficialUrl))
      .limit(1);
    if (existing) return { created: false, reason: 'duplicate', existingOpportunityId: existing.opportunityId };

    await tx.insert(opportunities).values({ id, slug: opportunity.slug, data: JSON.stringify(opportunity) });
    const inserted = await tx.insert(opportunityProvenance).values({
      opportunityId: id,
      originalOfficialUrl: input.provenance.originalOfficialUrl,
      normalizedOfficialUrl: input.provenance.normalizedOfficialUrl,
      sourceKind: input.provenance.sourceKind,
      sourceId: input.provenance.sourceId ?? null,
      ingestionRunId: input.provenance.ingestionRunId ?? null,
      capturedAt: input.provenance.capturedAt ?? new Date().toISOString(),
    }).onConflictDoNothing({ target: opportunityProvenance.normalizedOfficialUrl }).returning({ opportunityId: opportunityProvenance.opportunityId });

    if (inserted.length === 0) {
      await tx.delete(opportunities).where(eq(opportunities.id, id));
      return { created: false, reason: 'duplicate' };
    }
    return { created: true, opportunity };
  });
}

const socialCampaignTransitions: Record<SocialCampaignStatus, readonly SocialCampaignStatus[]> = {
  draft: ['approved'],
  approved: ['queued'],
  queued: ['published', 'failed'],
  published: [],
  failed: [],
};

export type SocialCampaignRepositoryErrorCode = 'not_found' | 'invalid' | 'conflict';

export class SocialCampaignRepositoryError extends Error {
  constructor(public readonly code: SocialCampaignRepositoryErrorCode, message: string) {
    super(message);
    this.name = 'SocialCampaignRepositoryError';
  }
}

/** Campaigns may only enter production for reviewed opportunities that are still actionable. */
export function validateSocialCampaignOpportunity(opportunity: Opportunity, now = new Date()): string[] {
  const errors: string[] = [];
  if (opportunity.status !== 'published') errors.push('La oportunidad debe estar publicada.');
  if (!opportunity.verifiedBy.trim() || !opportunity.verifiedAt || !Number.isFinite(Date.parse(opportunity.verifiedAt))) {
    errors.push('La oportunidad debe estar verificada por el equipo editorial.');
  }
  if (opportunity.isDemo) errors.push('No se puede crear una campaña para una oportunidad demo.');
  if (getDeadline(opportunity.closingDate, now).closed) errors.push('La oportunidad está vencida.');
  return errors;
}

type SocialCampaignDraftInput = Pick<SocialCampaign, 'id' | 'code'> & Partial<Pick<SocialCampaign, 'hook' | 'script' | 'coverText' | 'caption'>>;

export function buildSocialCampaignDraft(
  opportunity: Opportunity,
  input: SocialCampaignDraftInput,
  now = new Date(),
): SocialCampaign {
  const timestamp = now.toISOString();
  return {
    id: input.id,
    opportunityId: opportunity.id,
    platform: 'tiktok',
    code: input.code,
    hook: input.hook?.trim() || `¿Buscás una oportunidad como ${opportunity.title}?`,
    script: input.script?.trim() || `${opportunity.entity} tiene ${opportunity.vacancies} ${opportunity.vacancies === 1 ? 'vacante' : 'vacantes'} para ${opportunity.title}. Revisá los requisitos, la fecha de cierre y la fuente oficial en Oportunia.`,
    coverText: input.coverText?.trim() || `${opportunity.title} · ${opportunity.vacancies} ${opportunity.vacancies === 1 ? 'vacante' : 'vacantes'}`,
    caption: input.caption?.trim() || `Conocé los requisitos y revisá siempre la ficha completa y la fuente oficial en Oportunia. Código: ${input.code}`,
    publishedUrl: null,
    publishedAt: null,
    status: 'draft',
    reviewer: null,
    approvedAt: null,
    failureReason: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export interface SocialCampaignTransitionContext {
  actor: string;
  opportunity: Opportunity;
  publishedUrl?: string;
  failureReason?: string;
  now?: Date;
}

function isPublicTikTokUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && !url.username
      && !url.password
      && (url.hostname === 'tiktok.com' || url.hostname.endsWith('.tiktok.com'));
  } catch {
    return false;
  }
}

/** Apply one workflow edge; persistence separately uses optimistic state matching. */
export function applySocialCampaignTransition(
  campaign: SocialCampaign,
  nextStatus: SocialCampaignStatus,
  context: SocialCampaignTransitionContext,
): SocialCampaign {
  if (!socialCampaignTransitions[campaign.status]?.includes(nextStatus)) {
    throw new SocialCampaignRepositoryError('conflict', `Transición no válida: ${campaign.status} → ${nextStatus}.`);
  }

  const now = context.now ?? new Date();
  const updated: SocialCampaign = { ...campaign, status: nextStatus, updatedAt: now.toISOString() };

  if (nextStatus === 'approved') {
    const missing = [
      ['hook', campaign.hook],
      ['guion', campaign.script],
      ['texto de portada', campaign.coverText],
      ['caption', campaign.caption],
    ].filter(([, value]) => !value.trim()).map(([label]) => label);
    if (missing.length) {
      throw new SocialCampaignRepositoryError('invalid', `Completá ${missing.join(', ')} antes de aprobar.`);
    }
    const eligibilityErrors = validateSocialCampaignOpportunity(context.opportunity, now);
    if (eligibilityErrors.length) throw new SocialCampaignRepositoryError('invalid', eligibilityErrors.join(' '));
    if (!context.actor.trim()) throw new SocialCampaignRepositoryError('invalid', 'La aprobación requiere un revisor.');
    updated.reviewer = context.actor.trim();
    updated.approvedAt = now.toISOString();
  }

  if (nextStatus === 'queued') {
    const eligibilityErrors = validateSocialCampaignOpportunity(context.opportunity, now);
    if (eligibilityErrors.length) throw new SocialCampaignRepositoryError('invalid', eligibilityErrors.join(' '));
  }

  if (nextStatus === 'published') {
    const eligibilityErrors = validateSocialCampaignOpportunity(context.opportunity, now);
    if (eligibilityErrors.length) throw new SocialCampaignRepositoryError('invalid', eligibilityErrors.join(' '));
    const publishedUrl = context.publishedUrl?.trim() || '';
    if (!isPublicTikTokUrl(publishedUrl)) {
      throw new SocialCampaignRepositoryError('invalid', 'Ingresá una URL pública HTTPS de TikTok.');
    }
    updated.publishedUrl = publishedUrl;
    updated.publishedAt = now.toISOString();
    updated.failureReason = null;
  }

  if (nextStatus === 'failed') {
    const failureReason = context.failureReason?.trim() || '';
    if (!failureReason) throw new SocialCampaignRepositoryError('invalid', 'Indicá el motivo de la falla.');
    updated.failureReason = failureReason.slice(0, 1000);
  }

  return updated;
}

function asSocialCampaign(row: typeof socialCampaigns.$inferSelect): SocialCampaign {
  return {
    ...row,
    platform: row.platform as SocialCampaign['platform'],
    status: row.status as SocialCampaignStatus,
  };
}

function cleanCampaignText(value: string, maximum: number): string {
  return value.trim().slice(0, maximum);
}

function generatedCampaignCode(opportunity: Opportunity, id: string): string {
  const slug = opportunity.slug
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 48) || 'oportunidad';
  return `tt-${slug}-${id.slice(0, 8)}`;
}

export async function listSocialCampaigns(status?: SocialCampaignStatus): Promise<SocialCampaign[]> {
  const query = db.select().from(socialCampaigns);
  const rows = status
    ? await query.where(eq(socialCampaigns.status, status)).orderBy(desc(socialCampaigns.createdAt))
    : await query.orderBy(desc(socialCampaigns.createdAt));
  return rows.map(asSocialCampaign);
}

export async function getSocialCampaignById(id: string): Promise<SocialCampaign | undefined> {
  const [row] = await db.select().from(socialCampaigns).where(eq(socialCampaigns.id, id)).limit(1);
  return row ? asSocialCampaign(row) : undefined;
}

export interface CreateSocialCampaignInput {
  opportunityId: string;
  code?: string;
  hook?: string;
  script?: string;
  coverText?: string;
  caption?: string;
}

export async function createSocialCampaign(input: CreateSocialCampaignInput, now = new Date()): Promise<SocialCampaign> {
  const opportunity = await getOpportunityById(input.opportunityId);
  if (!opportunity) throw new SocialCampaignRepositoryError('not_found', 'La oportunidad no existe.');
  const eligibilityErrors = validateSocialCampaignOpportunity(opportunity, now);
  if (eligibilityErrors.length) throw new SocialCampaignRepositoryError('invalid', eligibilityErrors.join(' '));

  const id = randomUUID();
  const code = cleanCampaignText(input.code || generatedCampaignCode(opportunity, id), 80).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(code)) {
    throw new SocialCampaignRepositoryError('invalid', 'El código debe usar sólo minúsculas, números y guiones.');
  }
  const [duplicate] = await db.select({ id: socialCampaigns.id }).from(socialCampaigns).where(eq(socialCampaigns.code, code)).limit(1);
  if (duplicate) throw new SocialCampaignRepositoryError('conflict', 'Ya existe una campaña con ese código.');

  const campaign = buildSocialCampaignDraft(opportunity, {
    id,
    code,
    hook: input.hook === undefined ? undefined : cleanCampaignText(input.hook, 240),
    script: input.script === undefined ? undefined : cleanCampaignText(input.script, 8000),
    coverText: input.coverText === undefined ? undefined : cleanCampaignText(input.coverText, 160),
    caption: input.caption === undefined ? undefined : cleanCampaignText(input.caption, 2200),
  }, now);
  await db.insert(socialCampaigns).values(campaign);
  return campaign;
}

export interface UpdateSocialCampaignInput {
  id: string;
  hook?: string;
  script?: string;
  coverText?: string;
  caption?: string;
  status?: SocialCampaignStatus;
  publishedUrl?: string;
  failureReason?: string;
}

export async function updateSocialCampaign(
  input: UpdateSocialCampaignInput,
  actor: string,
  now = new Date(),
): Promise<SocialCampaign> {
  const current = await getSocialCampaignById(input.id);
  if (!current) throw new SocialCampaignRepositoryError('not_found', 'La campaña no existe.');

  const hasContentChanges = input.hook !== undefined
    || input.script !== undefined
    || input.coverText !== undefined
    || input.caption !== undefined;
  if (hasContentChanges && current.status !== 'draft') {
    throw new SocialCampaignRepositoryError('conflict', 'El contenido sólo puede editarse mientras la campaña está en borrador.');
  }

  let next: SocialCampaign = {
    ...current,
    hook: input.hook === undefined ? current.hook : cleanCampaignText(input.hook, 240),
    script: input.script === undefined ? current.script : cleanCampaignText(input.script, 8000),
    coverText: input.coverText === undefined ? current.coverText : cleanCampaignText(input.coverText, 160),
    caption: input.caption === undefined ? current.caption : cleanCampaignText(input.caption, 2200),
    updatedAt: now.toISOString(),
  };

  if (input.status !== undefined && input.status !== current.status) {
    const opportunity = await getOpportunityById(current.opportunityId);
    if (!opportunity) throw new SocialCampaignRepositoryError('not_found', 'La oportunidad asociada ya no existe.');
    next = applySocialCampaignTransition(next, input.status, {
      actor,
      opportunity,
      publishedUrl: input.publishedUrl,
      failureReason: input.failureReason,
      now,
    });
  } else if (!hasContentChanges) {
    throw new SocialCampaignRepositoryError('invalid', 'No se recibieron cambios para la campaña.');
  }

  const [updated] = await db.update(socialCampaigns).set({
    hook: next.hook,
    script: next.script,
    coverText: next.coverText,
    caption: next.caption,
    publishedUrl: next.publishedUrl,
    publishedAt: next.publishedAt,
    status: next.status,
    reviewer: next.reviewer,
    approvedAt: next.approvedAt,
    failureReason: next.failureReason,
    updatedAt: next.updatedAt,
  }).where(and(
    eq(socialCampaigns.id, current.id),
    eq(socialCampaigns.status, current.status),
    eq(socialCampaigns.updatedAt, current.updatedAt),
  )).returning();
  if (!updated) throw new SocialCampaignRepositoryError('conflict', 'La campaña cambió en otra sesión. Volvé a cargarla.');
  return asSocialCampaign(updated);
}

export interface SocialCampaignAnalyticsFilter {
  from?: string;
  to?: string;
}

/** Read and aggregate the anonymous event stream; no user-level data leaves this boundary. */
export async function getSocialCampaignAnalytics(filter: SocialCampaignAnalyticsFilter = {}) {
  const conditions = [isNotNull(events.content), ne(events.content, '')];
  if (filter.from) conditions.push(gte(events.createdAt, filter.from));
  if (filter.to) conditions.push(lte(events.createdAt, filter.to));

  const rows = await db.select({
    name: events.name,
    sessionId: events.sessionId,
    visitorId: events.visitorId,
    engagementMs: events.engagementMs,
    utmContent: events.content,
    opportunityId: events.opportunityId,
    createdAt: events.createdAt,
  }).from(events)
    .where(and(...conditions))
    .orderBy(desc(events.createdAt));

  return buildSocialAnalyticsReadModel(rows as AnonymousAnalyticsEvent[]);
}

export interface AdsenseRequestGateMetrics {
  publishedDemoCount: number;
  activeVerifiedOpportunityCount: number;
  originalGuideCount: number;
  measuredDays: number;
  hasAnalyticsAnomaly: boolean;
  homeReady: boolean;
  seoReady: boolean;
  legalReady: boolean;
  configurationReady: boolean;
}

interface AdsenseGateCheck {
  passed: boolean;
  current: number | boolean;
  required: number | boolean;
  message: string;
}

export interface AdsenseRequestGateResult {
  eligible: boolean;
  checks: Record<string, AdsenseGateCheck> & {
    activeVerifiedOpportunities: AdsenseGateCheck;
    originalGuides: AdsenseGateCheck;
  };
  blockers: string[];
}

/** Pure internal readiness gate. Guide counts and configuration checks are supplied by their owning systems. */
export function evaluateAdsenseRequestGate(metrics: AdsenseRequestGateMetrics): AdsenseRequestGateResult {
  const checks = {
    noPublishedDemos: { passed: metrics.publishedDemoCount === 0, current: metrics.publishedDemoCount, required: 0, message: 'No debe haber demos publicadas.' },
    activeVerifiedOpportunities: { passed: metrics.activeVerifiedOpportunityCount >= 30, current: metrics.activeVerifiedOpportunityCount, required: 30, message: 'Se requieren al menos 30 oportunidades vigentes y revisadas.' },
    originalGuides: { passed: metrics.originalGuideCount >= 10, current: metrics.originalGuideCount, required: 10, message: 'Se requieren al menos 10 guías originales.' },
    measuredDays: { passed: metrics.measuredDays >= 14, current: metrics.measuredDays, required: 14, message: 'Se requieren al menos 14 días medidos.' },
    analyticsHealthy: { passed: !metrics.hasAnalyticsAnomaly, current: metrics.hasAnalyticsAnomaly, required: false, message: 'La analítica no debe presentar anomalías.' },
    homeReady: { passed: metrics.homeReady, current: metrics.homeReady, required: true, message: 'La home debe estar lista.' },
    seoReady: { passed: metrics.seoReady, current: metrics.seoReady, required: true, message: 'Los controles SEO deben estar listos.' },
    legalReady: { passed: metrics.legalReady, current: metrics.legalReady, required: true, message: 'Las páginas legales deben estar listas.' },
    configurationReady: { passed: metrics.configurationReady, current: metrics.configurationReady, required: true, message: 'La configuración de AdSense debe estar lista.' },
  };
  const blockers = Object.values(checks).filter((check) => !check.passed).map((check) => check.message);
  return { eligible: blockers.length === 0, checks, blockers };
}
