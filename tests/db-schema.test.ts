import test from 'node:test';
import assert from 'node:assert/strict';
import { appProfiles, approvedSources, events, ingestionRuns, opportunities, opportunityProvenance, settings } from '../src/lib/db/schema';

// Access Drizzle internal column metadata via symbol key
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getColumns(table: any): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (table as any)[Symbol.for('drizzle:Columns')];
}

test('opportunities table has correct columns', () => {
  const columns = getColumns(opportunities);
  assert.ok(columns, 'opportunities should have columns');
  assert.ok(columns.id, 'should have id column');
  assert.ok(columns.slug, 'should have slug column');
  assert.ok(columns.data, 'should have data column');
});

test('events table has correct columns', () => {
  const columns = getColumns(events);
  assert.ok(columns, 'events should have columns');
  assert.ok(columns.id, 'should have id column');
  assert.ok(columns.name, 'should have name column');
  assert.ok(columns.opportunityId, 'should have opportunity_id column');
  assert.ok(columns.source, 'should have source column');
  assert.ok(columns.medium, 'should have medium column');
  assert.ok(columns.campaign, 'should have campaign column');
  assert.ok(columns.content, 'should have content column');
  assert.ok(columns.createdAt, 'should have created_at column');
});

test('settings table has correct columns', () => {
  const columns = getColumns(settings);
  assert.ok(columns, 'settings should have columns');
  assert.ok(columns.key, 'should have key column');
  assert.ok(columns.value, 'should have value column');
});

test('ingestion and authorization tables retain roles, source configuration, run history and URL provenance', () => {
  const profileColumns = getColumns(appProfiles);
  assert.ok(profileColumns.userId, 'app profiles should use the Neon Auth user id as primary key');
  assert.ok(profileColumns.role, 'app profiles should retain the application role');
  assert.ok(profileColumns.suspended, 'app profiles should fail closed while Neon Auth suspension is synchronized');

  const sourceColumns = getColumns(approvedSources);
  assert.ok(sourceColumns.id);
  assert.ok(sourceColumns.url);
  assert.ok(sourceColumns.enabled);

  const runColumns = getColumns(ingestionRuns);
  assert.ok(runColumns.sourceId);
  assert.ok(runColumns.status);
  assert.ok(runColumns.error);

  const provenanceColumns = getColumns(opportunityProvenance);
  assert.ok(provenanceColumns.opportunityId);
  assert.ok(provenanceColumns.originalOfficialUrl);
  assert.ok(provenanceColumns.normalizedOfficialUrl);
  assert.ok(provenanceColumns.sourceId);
  assert.ok(provenanceColumns.ingestionRunId);
});
