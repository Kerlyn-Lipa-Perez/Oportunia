import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { requireIsolatedDatabaseUrl } from './integration/database-test-guard';

type GateManifest = { defaultGate: string[] };

function readGateManifest(): GateManifest {
  return JSON.parse(readFileSync('tests/gate-manifest.json', 'utf8')) as GateManifest;
}

function defaultGateFilesOnDisk(): string[] {
  return readdirSync('tests')
    .filter((name) => name.endsWith('.test.ts'))
    .map((name) => `tests/${name}`);
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>;
};

test('the default test gate excludes database integration tests', () => {
  assert.equal(packageJson.scripts.test, 'tsx --test tests/*.test.ts');
  assert.ok(!packageJson.scripts.test.includes('integration'));
  assert.equal(existsSync('tests/db-integration.test.ts'), false);
  assert.equal(existsSync('tests/integration/db-integration.test.ts'), true);
});

test('database integration requires an explicit isolated database opt-in', () => {
  assert.equal(
    packageJson.scripts['test:integration'],
    'tsx --test tests/integration/*.test.ts',
  );

  const source = readFileSync('tests/integration/db-integration.test.ts', 'utf8');
  const guardSource = readFileSync('tests/integration/database-test-guard.ts', 'utf8');
  assert.match(guardSource, /ALLOW_DATABASE_TESTS/);
  assert.match(guardSource, /TEST_DATABASE_URL/);
  assert.doesNotMatch(`${source}\n${guardSource}`, /readFileSync|loadDotEnvFile/);
});

test('database integration rejects the current database target before loading database modules', () => {
  const currentDatabaseUrl =
    'postgresql://app:production-secret@EP-CURRENT.example.com:5432/oportunia?sslmode=require';
  const sameTargetWithDifferentCredentials =
    'postgres://tester:test-secret@ep-current.example.com/oportunia?connect_timeout=10';

  assert.throws(
    () =>
      requireIsolatedDatabaseUrl({
        ALLOW_DATABASE_TESTS: 'true',
        DATABASE_URL: currentDatabaseUrl,
        TEST_DATABASE_URL: `  ${sameTargetWithDifferentCredentials}  `,
      }),
    (error: Error) => {
      assert.match(error.message, /isolated database target/i);
      assert.doesNotMatch(error.message, /production-secret|test-secret/);
      return true;
    },
  );

  const source = readFileSync('tests/integration/db-integration.test.ts', 'utf8');
  const guardIndex = source.indexOf('requireIsolatedDatabaseUrl(process.env)');
  const repositoryImportIndex = source.indexOf("import('../../src/lib/repository')");
  const databaseImportIndex = source.indexOf("import('../../src/lib/db/index')");

  assert.ok(guardIndex >= 0, 'the isolation guard must run at module initialization');
  assert.ok(repositoryImportIndex > guardIndex, 'repository must load only after the isolation guard');
  assert.ok(databaseImportIndex > guardIndex, 'database client must load only after the isolation guard');
  assert.doesNotMatch(source, /^import .*src\/lib\/(?:repository|db\/index)/m);
});

test('every suite the default gate picks up is registered, including the consent bridge', () => {
  const registered = new Set(readGateManifest().defaultGate);

  assert.ok(
    registered.has('tests/cmp-bridge.test.ts'),
    'the consent bridge suite must be registered in the default gate file list',
  );

  for (const file of defaultGateFilesOnDisk()) {
    assert.ok(registered.has(file), `${file} must be registered in tests/gate-manifest.json`);
  }
});

test('registered default-gate suites exist and integration suites stay out of the list', () => {
  const onDisk = defaultGateFilesOnDisk();

  for (const file of readGateManifest().defaultGate) {
    assert.ok(onDisk.includes(file), `registered ${file} must exist under tests/`);
    assert.doesNotMatch(file, /integration/, 'the default gate never registers integration suites');
  }
});

test('database integration requires a distinct current database target for comparison', () => {
  assert.throws(
    () =>
      requireIsolatedDatabaseUrl({
        ALLOW_DATABASE_TESTS: 'true',
        TEST_DATABASE_URL: 'postgresql://tester:secret@ep-test.example.com/oportunia_test',
      }),
    /DATABASE_URL.*required/i,
  );

  assert.equal(
    requireIsolatedDatabaseUrl({
      ALLOW_DATABASE_TESTS: 'true',
      DATABASE_URL: 'postgresql://app:secret@ep-current.example.com/oportunia',
      TEST_DATABASE_URL: 'postgresql://tester:secret@ep-test.example.com/oportunia',
    }),
    'postgresql://tester:secret@ep-test.example.com/oportunia',
  );
});
