import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolveAdminE2eCredentials, resolveExternalBaseUrl } from '../e2e/config';

test('E2E base URL requires an explicit external HTTP endpoint', () => {
  assert.throws(
    () => resolveExternalBaseUrl({}),
    /E2E_BASE_URL or PLAYWRIGHT_BASE_URL/,
  );
  assert.throws(
    () => resolveExternalBaseUrl({ E2E_BASE_URL: 'http://localhost:3000' }),
    /external deployed environment/,
  );
  assert.throws(
    () => resolveExternalBaseUrl({ PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:3000' }),
    /external deployed environment/,
  );
  assert.throws(
    () => resolveExternalBaseUrl({ E2E_BASE_URL: 'file:///tmp/oportunia' }),
    /HTTP or HTTPS/,
  );

  assert.equal(
    resolveExternalBaseUrl({ E2E_BASE_URL: 'https://preview.example.test/' }),
    'https://preview.example.test',
  );
  assert.equal(
    resolveExternalBaseUrl({ PLAYWRIGHT_BASE_URL: 'https://fallback.example.test' }),
    'https://fallback.example.test',
  );
});

test('admin E2E credentials are explicit and passwords never have defaults', () => {
  assert.throws(() => resolveAdminE2eCredentials({}), /E2E_ADMIN_EMAIL/);
  assert.throws(() => resolveAdminE2eCredentials({
    E2E_ADMIN_EMAIL: 'admin@example.com',
    E2E_ADMIN_PASSWORD: 'admin-password',
    E2E_EDITOR_EMAIL: 'editor@example.com',
  }), /E2E_EDITOR_PASSWORD/);

  assert.deepEqual(resolveAdminE2eCredentials({
    E2E_ADMIN_EMAIL: 'admin@example.com',
    E2E_ADMIN_PASSWORD: 'admin-password',
    E2E_EDITOR_EMAIL: 'editor@example.com',
    E2E_EDITOR_PASSWORD: 'editor-password',
  }), {
    adminEmail: 'admin@example.com',
    adminPassword: 'admin-password',
    editorEmail: 'editor@example.com',
    editorPassword: 'editor-password',
  });
});

test('Playwright harness is mobile-only, external-only and never starts a local server', () => {
  const config = readFileSync('playwright.config.ts', 'utf8');
  const spec = readFileSync('e2e/tiktok-funnel.spec.ts', 'utf8');
  const adminSpec = readFileSync('e2e/admin-users.spec.ts', 'utf8');
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
    scripts?: Record<string, string>;
  };

  assert.match(config, /resolveExternalBaseUrl\(process\.env\)/);
  assert.match(config, /devices\[['"](?:Pixel|iPhone)/);
  assert.doesNotMatch(config, /webServer\s*:/);
  assert.doesNotMatch(config, /DATABASE_URL|dotenv|loadEnvConfig/);
  assert.match(config, /VERCEL_AUTOMATION_BYPASS_SECRET/);
  assert.match(config, /x-vercel-protection-bypass/);
  assert.match(config, /x-vercel-set-bypass-cookie/);
  assert.equal(packageJson.scripts?.['test:e2e'], 'playwright test');

  assert.match(spec, /\/tiktok/);
  assert.match(spec, /utm_source/);
  assert.match(spec, /utm_medium/);
  assert.match(spec, /utm_campaign/);
  assert.match(spec, /utm_content/);
  assert.match(spec, /fuente oficial/i);
  assert.doesNotMatch(spec, /test\.skip|\.skip\(/);
  assert.match(adminSpec, /resolveAdminE2eCredentials/);
  assert.match(adminSpec, /\/api\/admin\/users/);
  assert.match(adminSpec, /Cuenta creada/);
  assert.match(adminSpec, /Suspendida/);
  assert.doesNotMatch(adminSpec, /test\.skip|\.skip\(/);
});
