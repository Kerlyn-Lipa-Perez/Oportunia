import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const migrationsDirectory = join(process.cwd(), 'drizzle');

test('ingestion schema is represented by a versioned Drizzle migration', () => {
  assert.ok(existsSync(migrationsDirectory), 'Drizzle migrations directory should exist');
  assert.ok(
    existsSync(join(migrationsDirectory, 'meta', '_journal.json')),
    'Drizzle migration journal should exist',
  );

  const migrationSql = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => readFileSync(join(migrationsDirectory, file), 'utf8'))
    .join('\n');

  for (const table of ['app_profiles', 'approved_sources', 'ingestion_runs', 'opportunity_provenance']) {
    assert.match(migrationSql, new RegExp(`CREATE TABLE \\\"${table}\\\"`));
  }

  assert.match(migrationSql, /CONSTRAINT "approved_sources_url_unique" UNIQUE\("url"\)/);
  assert.match(migrationSql, /CONSTRAINT "opportunity_provenance_normalized_official_url_unique" UNIQUE\("normalized_official_url"\)/);
  assert.match(migrationSql, /REFERENCES "public"\."approved_sources"\("id"\)/);
  assert.match(migrationSql, /REFERENCES "public"\."ingestion_runs"\("id"\)/);
  assert.match(migrationSql, /ADD COLUMN "suspended" boolean DEFAULT false NOT NULL/);
  assert.match(migrationSql, /app_profiles_role_check/);
  assert.match(migrationSql, /ensure_active_admin_remains/);
  assert.match(migrationSql, /app_profiles_preserve_active_admin/);
});
