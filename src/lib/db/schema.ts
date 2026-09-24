import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, pgTable, text } from 'drizzle-orm/pg-core';

export const opportunities = pgTable('opportunities', {
  id: text('id').primaryKey(),
  slug: text('slug').unique().notNull(),
  data: text('data').notNull(),
});

export const events = pgTable(
  'events',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    opportunityId: text('opportunity_id'),
    source: text('source'),
    medium: text('medium'),
    campaign: text('campaign'),
    content: text('content'),
    sessionId: text('session_id'),
    // Reserved for a future consent-aware analytics integration. The current
    // public API never accepts it because advertising consent is not analytics consent.
    visitorId: text('visitor_id'),
    engagementMs: integer('engagement_ms'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('events_content_name_created_at_idx').on(table.content, table.name, table.createdAt),
    index('events_content_session_created_at_idx').on(table.content, table.sessionId, table.createdAt),
    index('events_session_name_created_at_idx').on(table.sessionId, table.name, table.createdAt),
    check('events_engagement_ms_check', sql`${table.engagementMs} is null or ${table.engagementMs} between 0 and 60000`),
  ],
);

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// Neon Auth owns identities and credentials. This table only assigns an
// application role to the stable Neon Auth user id.
export const appProfiles = pgTable(
  'app_profiles',
  {
    userId: text('user_id').primaryKey(),
    role: text('role').notNull(),
    suspended: boolean('suspended').notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('app_profiles_role_suspended_idx').on(table.role, table.suspended),
    check('app_profiles_role_check', sql`${table.role} in ('admin', 'editor')`),
  ],
);

// A source is an explicitly approved URL, never a domain-wide crawl target.
export const approvedSources = pgTable('approved_sources', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull().unique(),
  kind: text('kind').notNull(),
  enabled: boolean('enabled').notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const ingestionRuns = pgTable('ingestion_runs', {
  id: text('id').primaryKey(),
  sourceId: text('source_id').references(() => approvedSources.id),
  trigger: text('trigger').notNull(),
  status: text('status').notNull(),
  importedCount: integer('imported_count').notNull().default(0),
  invalidCount: integer('invalid_count').notNull().default(0),
  duplicateCount: integer('duplicate_count').notNull().default(0),
  error: text('error'),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
});

// Keep ingestion metadata outside the public opportunity payload. The unique
// normalized URL is the persistence-level guard against repeated imports.
export const opportunityProvenance = pgTable('opportunity_provenance', {
  opportunityId: text('opportunity_id').primaryKey().references(() => opportunities.id),
  originalOfficialUrl: text('original_official_url').notNull(),
  normalizedOfficialUrl: text('normalized_official_url').notNull().unique(),
  sourceKind: text('source_kind').notNull(),
  sourceId: text('source_id').references(() => approvedSources.id),
  ingestionRunId: text('ingestion_run_id').references(() => ingestionRuns.id),
  capturedAt: text('captured_at').notNull(),
});

export const socialCampaigns = pgTable(
  'social_campaigns',
  {
    id: text('id').primaryKey(),
    opportunityId: text('opportunity_id').notNull().references(() => opportunities.id),
    platform: text('platform').notNull().default('tiktok'),
    code: text('code').notNull().unique(),
    hook: text('hook').notNull(),
    script: text('script').notNull(),
    coverText: text('cover_text').notNull(),
    caption: text('caption').notNull(),
    publishedUrl: text('published_url'),
    publishedAt: text('published_at'),
    status: text('status').notNull().default('draft'),
    reviewer: text('reviewer'),
    approvedAt: text('approved_at'),
    failureReason: text('failure_reason'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('social_campaigns_opportunity_id_idx').on(table.opportunityId),
    index('social_campaigns_status_idx').on(table.status),
    check('social_campaigns_platform_check', sql`${table.platform} = 'tiktok'`),
    check('social_campaigns_status_check', sql`${table.status} in ('draft', 'approved', 'queued', 'published', 'failed')`),
  ],
);
