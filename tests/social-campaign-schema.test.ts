import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { events, socialCampaigns } from '../src/lib/db/schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getColumns(table: any): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (table as any)[Symbol.for('drizzle:Columns')];
}

test('social campaigns retain editorial workflow and publication metadata', () => {
  const columns = getColumns(socialCampaigns);
  for (const column of [
    'id', 'opportunityId', 'platform', 'code', 'hook', 'script', 'coverText', 'caption',
    'publishedUrl', 'publishedAt', 'status', 'reviewer', 'approvedAt', 'failureReason',
    'createdAt', 'updatedAt',
  ]) {
    assert.ok(columns[column], `missing social_campaigns.${column}`);
  }
});

test('social campaign migration has relational and analytics indexes', () => {
  const path = join(process.cwd(), 'drizzle', '0002_add_social_campaigns.sql');
  assert.equal(existsSync(path), true, 'missing versioned social campaign migration');
  const migration = readFileSync(path, 'utf8');
  assert.match(migration, /CREATE TABLE "social_campaigns"/);
  assert.match(migration, /UNIQUE\("code"\)/);
  assert.match(migration, /REFERENCES "public"\."opportunities"\("id"\)/);
  assert.match(migration, /CREATE INDEX "social_campaigns_status_idx"/);
  assert.match(migration, /CREATE INDEX "events_content_name_created_at_idx"/);
});

test('privacy-first event schema stores only opaque analytics identifiers and bounded engagement', () => {
  const columns = getColumns(events);
  assert.ok(columns.sessionId, 'missing events.session_id');
  assert.ok(columns.visitorId, 'missing nullable events.visitor_id for future consent-aware analytics');
  assert.ok(columns.engagementMs, 'missing events.engagement_ms');

  const path = join(process.cwd(), 'drizzle', '0003_add_privacy_first_analytics.sql');
  assert.equal(existsSync(path), true, 'missing versioned privacy analytics migration');
  const migration = readFileSync(path, 'utf8');
  assert.match(migration, /ADD COLUMN "session_id" text/);
  assert.match(migration, /ADD COLUMN "visitor_id" text/);
  assert.match(migration, /ADD COLUMN "engagement_ms" integer/);
  assert.match(migration, /engagement_ms.*BETWEEN 0 AND 60000/i);
  assert.match(migration, /events_content_session_created_at_idx/);
});
