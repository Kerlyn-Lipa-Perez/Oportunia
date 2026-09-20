import { randomUUID } from 'node:crypto';
import { desc, eq, inArray } from 'drizzle-orm';
import type { Opportunity } from './types';
import { getDeadline, isPublicOpportunity } from './opportunities';
import { db } from './db';
import {
  appProfiles,
  approvedSources,
  events,
  ingestionRuns,
  opportunities,
  opportunityProvenance,
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
