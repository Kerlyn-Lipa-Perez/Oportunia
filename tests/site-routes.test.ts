import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import nextConfig from '../next.config';

test('no redirect sends requests away from the canonical origin', () => {
  assert.equal(nextConfig.redirects, undefined);
  const vercelConfig = JSON.parse(readFileSync('vercel.json', 'utf8')) as Record<string, unknown>;
  assert.equal(vercelConfig.redirects, undefined);
});

test('required owned pages and ads.txt route exist without fabricated identifiers', () => {
  const pages = ['nosotros', 'contacto', 'privacidad', 'cookies', 'terminos'];
  for (const page of pages) {
    assert.equal(existsSync(`src/app/${page}/page.tsx`), true, `${page} page should exist`);
  }
  assert.equal(existsSync('src/app/ads.txt/route.ts'), true);

  const combined = pages
    .map((page) => readFileSync(`src/app/${page}/page.tsx`, 'utf8'))
    .join('\n');
  assert.doesNotMatch(combined, /pub-\d{16}|ca-pub-\d{16}/);
  assert.doesNotMatch(combined, /RUC\s*(?:N[.°ºo]*\s*)?\d{11}/i);
});

test('layout keeps metadataBase and the AdSense provider without leaking a root canonical', () => {
  const layout = readFileSync('src/app/layout.tsx', 'utf8');
  assert.match(layout, /resolveSiteConfig/);
  assert.match(layout, /AdsenseProvider/);
  assert.match(layout, /metadataBase:\s*new URL\(site\.url\)/);
  assert.doesNotMatch(layout, /alternates:\s*\{\s*canonical:/);
  assert.doesNotMatch(layout, /localhost/);
});

test('every indexable static page and TikTok declares its own canonical', () => {
  const pages = new Map([
    ['src/app/page.tsx', '/'],
    ['src/app/como-funciona/page.tsx', '/como-funciona'],
    ['src/app/nosotros/page.tsx', '/nosotros'],
    ['src/app/contacto/page.tsx', '/contacto'],
    ['src/app/privacidad/page.tsx', '/privacidad'],
    ['src/app/cookies/page.tsx', '/cookies'],
    ['src/app/terminos/page.tsx', '/terminos'],
    ['src/app/tiktok/page.tsx', '/tiktok'],
  ]);

  for (const [file, canonical] of pages) {
    const source = readFileSync(file, 'utf8');
    assert.match(
      source,
      new RegExp(`alternates:\\s*\\{\\s*canonical:\\s*["']${canonical.replace('/', '\\/')}["']`),
      `${file} should declare ${canonical} as its canonical`,
    );
  }
});

test('environment example is production-safe and leaves real IDs empty', () => {
  const environment = readFileSync('.env.example', 'utf8');
  assert.match(environment, /^NEXT_PUBLIC_SITE_URL=https:\/\/oportunia-six\.vercel\.app$/m);
  assert.match(environment, /^SEO_INDEXING_ENABLED=false$/m);
  assert.match(environment, /^ADSENSE_ENABLED=false$/m);
  assert.match(environment, /^ADSENSE_READINESS_CONFIRMED=false$/m);
  assert.match(environment, /^ADSENSE_PUBLISHER_ID=$/m);
  assert.match(environment, /^ADSENSE_SLOT_CATALOG_END=$/m);
  assert.match(environment, /^TEST_DATABASE_URL=$/m);
  assert.match(environment, /^ALLOW_DATABASE_TESTS=false$/m);
  assert.doesNotMatch(environment, /pub-\d{16}|ca-pub-\d{16}/);
});

test('production runbook keeps external DNS, Vercel and CMP work explicit', () => {
  assert.equal(existsSync('docs/production-readiness.md'), true);
  const runbook = readFileSync('docs/production-readiness.md', 'utf8');
  assert.match(runbook, /DNS/i);
  assert.match(runbook, /Vercel/i);
  assert.match(runbook, /CMP certificada/i);
  assert.match(runbook, /ADSENSE_READINESS_CONFIRMED=true/);
  assert.match(runbook, /evaluación interna/i);
  assert.match(runbook, /AdSense Ready/i);
  assert.match(runbook, /SEO_INDEXING_ENABLED=false/);
  assert.match(runbook, /ALLOW_DATABASE_TESTS=true/);
  assert.match(runbook, /Search Console/i);
  assert.match(runbook, /30 oportunidades/i);
  assert.match(runbook, /10 guías/i);
  assert.match(runbook, /dos semanas/i);
  assert.match(runbook, /cero contenido demo/i);
  assert.match(runbook, /E2E_ADMIN_EMAIL/);
  assert.match(runbook, /0000.*0001.*0002.*0003.*0004/s);
  assert.match(runbook, /producción.*después.*E2E/is);
});

test('admin provisioning runbook preserves the two-layer role and branch-first order', () => {
  const runbook = readFileSync('docs/neon-admin-provisioning.md', 'utf8');

  assert.match(runbook, /app_profiles.*antes.*Neon Auth/is);
  assert.match(runbook, /admin.*Neon.*admin/is);
  assert.match(runbook, /editor.*Neon.*user/is);
  assert.match(runbook, /12 caracteres/i);
  assert.match(runbook, /último administrador activo/i);
  assert.match(runbook, /revoc/i);
  assert.match(runbook, /rama aislada/i);
  assert.match(runbook, /no.*(borrado|eliminar).*suplantación.*reset/is);
});
