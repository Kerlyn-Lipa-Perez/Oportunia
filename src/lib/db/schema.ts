import { pgTable, text } from 'drizzle-orm/pg-core';

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
