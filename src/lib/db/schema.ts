import { boolean, integer, pgTable, text } from 'drizzle-orm/pg-core';

export const opportunities = pgTable('opportunities', {
  id: text('id').primaryKey(),
  slug: text('slug').unique().notNull(),
  data: text('data').notNull(),
});

export const events = pgTable('events', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  opportunityId: text('opportunity_id'),
  source: text('source'),
  medium: text('medium'),
  campaign: text('campaign'),
  content: text('content'),
  createdAt: text('created_at').notNull(),
});

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// Neon Auth owns identities and credentials. This table only assigns an
// application role to the stable Neon Auth user id.
export const appProfiles = pgTable('app_profiles', {
  userId: text('user_id').primaryKey(),
  role: text('role').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

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
