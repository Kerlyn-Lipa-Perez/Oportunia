import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CANONICAL_PRODUCTION_URL,
  buildRobots,
  buildSitemapEntries,
  resolveSiteConfig,
} from '../src/lib/site/config';
import {
  ADSENSE_CONSENT_EVENT,
  buildAdsTxtResponse,
  canRenderAd,
  parseAdsenseConfig,
  parseConsentEvent,
} from '../src/lib/site/adsense';

test('production site config never emits localhost and only enables SEO explicitly', () => {
  const missing = resolveSiteConfig({ NODE_ENV: 'production' });
  assert.equal(missing.url, CANONICAL_PRODUCTION_URL);
  assert.equal(missing.seoIndexingEnabled, false);

  const unsafe = resolveSiteConfig({
    NODE_ENV: 'production',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    SEO_INDEXING_ENABLED: 'true',
  });
  assert.equal(unsafe.url, CANONICAL_PRODUCTION_URL);
  assert.equal(unsafe.seoIndexingEnabled, false);

  const healthy = resolveSiteConfig({
    NODE_ENV: 'production',
    NEXT_PUBLIC_SITE_URL: 'https://oportuniape.com/',
    SEO_INDEXING_ENABLED: 'true',
  });
  assert.equal(healthy.url, CANONICAL_PRODUCTION_URL);
  assert.equal(healthy.seoIndexingEnabled, true);
});

test('robots is fail-closed and always protects private routes', () => {
  const blocked = buildRobots(resolveSiteConfig({ NODE_ENV: 'production' }));
  assert.deepEqual(blocked.rules, {
    userAgent: '*',
    disallow: '/',
  });
  assert.equal(blocked.sitemap, undefined);

  const enabled = buildRobots(resolveSiteConfig({
    NODE_ENV: 'production',
    NEXT_PUBLIC_SITE_URL: CANONICAL_PRODUCTION_URL,
    SEO_INDEXING_ENABLED: 'true',
  }));
  assert.deepEqual(enabled.rules, {
    userAgent: '*',
    allow: '/',
    disallow: ['/admin', '/api/'],
  });
  assert.equal(enabled.sitemap, `${CANONICAL_PRODUCTION_URL}/sitemap.xml`);
});

test('sitemap includes legal pages and only active, non-demo opportunities with real modified dates', () => {
  const config = resolveSiteConfig({
    NODE_ENV: 'production',
    NEXT_PUBLIC_SITE_URL: CANONICAL_PRODUCTION_URL,
    SEO_INDEXING_ENABLED: 'true',
  });
  const entries = buildSitemapEntries(config, [
    {
      slug: 'active-role',
      status: 'published',
      isDemo: false,
      verifiedAt: '2026-09-18T10:00:00.000Z',
      publishedAt: '2026-09-17T10:00:00.000Z',
    },
    {
      slug: 'demo-role',
      status: 'published',
      isDemo: true,
      verifiedAt: '2026-09-18T10:00:00.000Z',
      publishedAt: '2026-09-17T10:00:00.000Z',
    },
    {
      slug: 'closed-role',
      status: 'closed',
      isDemo: false,
      verifiedAt: '2026-09-18T10:00:00.000Z',
      publishedAt: '2026-09-17T10:00:00.000Z',
    },
  ]);

  const urls = entries.map((entry) => entry.url);
  for (const path of ['/', '/como-funciona', '/nosotros', '/contacto', '/privacidad', '/cookies', '/terminos']) {
    assert.ok(urls.includes(new URL(path, `${CANONICAL_PRODUCTION_URL}/`).toString().replace(/\/$/, path === '/' ? '' : '')));
  }
  const active = entries.find((entry) => entry.url.endsWith('/convocatorias/active-role'));
  assert.equal(active?.lastModified, '2026-09-18T10:00:00.000Z');
  assert.ok(!urls.some((url) => url.includes('demo-role')));
  assert.ok(!urls.some((url) => url.includes('closed-role')));
  assert.equal(buildSitemapEntries(resolveSiteConfig({ NODE_ENV: 'production' }), []).length, 0);
});

test('AdSense config, ads.txt and consent all fail closed', async () => {
  const disabled = parseAdsenseConfig({});
  assert.equal(disabled.enabled, false);
  assert.equal(canRenderAd(disabled, 'granted', 'catalog-end'), false);
  assert.equal((await buildAdsTxtResponse(disabled)).status, 404);

  const invalid = parseAdsenseConfig({
    ADSENSE_ENABLED: 'true',
    ADSENSE_PUBLISHER_ID: 'pub-placeholder',
    ADSENSE_SLOT_CATALOG_END: 'slot-placeholder',
  });
  assert.equal(invalid.enabled, false);
  assert.equal((await buildAdsTxtResponse(invalid)).status, 404);

  const configured = parseAdsenseConfig({
    ADSENSE_ENABLED: 'true',
    ADSENSE_PUBLISHER_ID: 'pub-1234567890123456',
    ADSENSE_SLOT_CATALOG_END: '1234567890',
  });
  assert.equal(configured.enabled, false);
  assert.equal(configured.clientId, 'ca-pub-1234567890123456');
  assert.equal(canRenderAd(configured, 'granted', 'catalog-end'), false);
  assert.equal((await buildAdsTxtResponse(configured)).status, 404);

  const ready = parseAdsenseConfig({
    ADSENSE_ENABLED: 'true',
    ADSENSE_READINESS_CONFIRMED: 'true',
    ADSENSE_PUBLISHER_ID: 'pub-1234567890123456',
    ADSENSE_SLOT_CATALOG_END: '1234567890',
    ADSENSE_SLOT_DETAIL_BODY: '9876543210',
  });
  assert.equal(ready.enabled, true);
  assert.equal(ready.clientId, 'ca-pub-1234567890123456');
  assert.deepEqual(ready.slots, {
    'catalog-end': '1234567890',
    'detail-body': '9876543210',
  });
  assert.equal(canRenderAd(ready, 'unknown', 'catalog-end'), false);
  assert.equal(canRenderAd(ready, 'denied', 'catalog-end'), false);
  assert.equal(canRenderAd(ready, 'granted', 'catalog-end'), true);
  assert.equal(canRenderAd(ready, 'unknown', 'detail-body'), false);
  assert.equal(canRenderAd(ready, 'denied', 'detail-body'), false);
  assert.equal(canRenderAd(ready, 'granted', 'detail-body'), true);
  assert.equal(canRenderAd(ready, 'granted', 'detail-cta'), false);

  const adsTxt = await buildAdsTxtResponse(ready);
  assert.equal(adsTxt.status, 200);
  assert.equal(
    await adsTxt.text(),
    'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n',
  );
});

test('AdSense validates detail and catalog slots independently without inventing fallbacks', () => {
  const missingDetail = parseAdsenseConfig({
    ADSENSE_ENABLED: 'true',
    ADSENSE_READINESS_CONFIRMED: 'true',
    ADSENSE_PUBLISHER_ID: 'pub-1234567890123456',
    ADSENSE_SLOT_CATALOG_END: '1234567890',
  });
  assert.deepEqual(missingDetail.slots, { 'catalog-end': '1234567890' });
  assert.equal(canRenderAd(missingDetail, 'granted', 'catalog-end'), true);
  assert.equal(canRenderAd(missingDetail, 'granted', 'detail-body'), false);

  const invalidDetail = parseAdsenseConfig({
    ADSENSE_ENABLED: 'true',
    ADSENSE_READINESS_CONFIRMED: 'true',
    ADSENSE_PUBLISHER_ID: 'pub-1234567890123456',
    ADSENSE_SLOT_CATALOG_END: '1234567890',
    ADSENSE_SLOT_DETAIL_BODY: 'detail-placeholder',
  });
  assert.deepEqual(invalidDetail.slots, { 'catalog-end': '1234567890' });
  assert.equal(canRenderAd(invalidDetail, 'granted', 'detail-body'), false);
});

test('opportunity detail gives its body ad an explicit position away from official source UI', () => {
  const detail = readFileSync('src/app/convocatorias/[slug]/page.tsx', 'utf8');
  const adsenseClient = readFileSync('src/lib/site/adsense-client.tsx', 'utf8');
  const ad = detail.indexOf('<AdSlot position="detail-body" />');
  const requirements = detail.indexOf('requirements-list');
  const dates = detail.indexOf('Las fechas, a mano.');
  const officialSource = detail.indexOf('Documentos y fuente');

  assert.ok(ad > requirements, 'detail-body ad must follow the requirements content');
  assert.ok(ad < dates, 'detail-body ad must be separated from the official source section by the dates section');
  assert.ok(dates < officialSource, 'dates content must separate the ad from the official source link');
  assert.doesNotMatch(detail, /<AdSlot\s*\/>/);

  const eligibilityGuard = adsenseClient.indexOf('if (!eligible) return null;');
  const script = adsenseClient.indexOf('<Script', eligibilityGuard);
  const semanticSlot = adsenseClient.indexOf('<aside', eligibilityGuard);
  assert.ok(eligibilityGuard >= 0, 'an ineligible position must render nothing');
  assert.ok(script > eligibilityGuard, 'the AdSense script must only exist behind slot eligibility');
  assert.ok(semanticSlot > eligibilityGuard, 'the eligible ad must render as a semantic aside');
});

test('only the documented exact consent event can grant advertising consent', () => {
  assert.equal(ADSENSE_CONSENT_EVENT, 'oportunia:ads-consent');
  assert.equal(parseConsentEvent({ detail: { status: 'granted' } }), 'granted');
  assert.equal(parseConsentEvent({ detail: { status: 'denied' } }), 'denied');
  assert.equal(parseConsentEvent({ detail: { status: 'yes' } }), 'unknown');
  assert.equal(parseConsentEvent({}), 'unknown');
});

test('the shared brand renders the Cubik logo in a fixed proportional frame', () => {
  const portal = readFileSync('src/components/portal.tsx', 'utf8');
  const styles = readFileSync('src/app/globals.css', 'utf8');

  assert.match(portal, /src="\/logo_cubik\.png"/);
  assert.match(portal, /className="brand-logo"/);
  assert.match(styles, /\.brand-logo\{[^}]*width:40px[^}]*height:40px[^}]*object-fit:contain/);
});
