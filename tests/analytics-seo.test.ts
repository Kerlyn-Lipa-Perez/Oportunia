import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  GA4_SCRIPT_ID,
  initializeGoogleAnalytics,
  parseGoogleAnalyticsConfig,
  synchronizeGoogleAnalyticsConsent,
  trackGoogleAnalyticsPageView,
  type AnalyticsRuntime,
} from '../src/lib/site/analytics';
import {
  buildConsentDetail,
  canRenderAd,
  type AdsenseConfig,
  type ConsentPurposes,
} from '../src/lib/site/adsense';
import { buildOpportunityMetadata } from '../src/lib/site/opportunity-metadata';
import type { Opportunity } from '../src/lib/types';

// Purpose fixtures for the Consent Mode v2 split (design D3): GA4 follows
// analytics_storage only, ad slots follow ad_storage only.
const ANALYTICS_GRANTED_ADS_DENIED: ConsentPurposes = {
  analytics_storage: 'granted',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
};

const ADS_GRANTED_ANALYTICS_DENIED: ConsentPurposes = {
  analytics_storage: 'denied',
  ad_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
};

const ALL_GRANTED: ConsentPurposes = {
  analytics_storage: 'granted',
  ad_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
};

const ALL_DENIED: ConsentPurposes = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
};

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opp-1',
    slug: 'analista-publico',
    entity: 'Entidad pública',
    entityShort: 'EP',
    title: 'Analista',
    type: 'Empleo público',
    region: 'Lima',
    modality: 'Híbrido',
    level: 'Profesional',
    careers: ['Administración'],
    vacancies: 1,
    closingDate: '2026-09-30',
    officialUrl: 'https://www.gob.pe/institucion/example/convocatorias/1',
    summary: 'Una oportunidad vigente.',
    beforeApplying: 'Revisá las bases.',
    requirements: ['Título profesional'],
    status: 'published',
    verifiedAt: '2026-09-19T10:00:00.000Z',
    verifiedBy: 'Equipo Oportunia',
    publishedAt: '2026-09-19T11:00:00.000Z',
    isDemo: false,
    featured: false,
    color: '#245be8',
    ...overrides,
  };
}

test('GA4 config is enabled only for a valid, explicit measurement ID', () => {
  assert.deepEqual(parseGoogleAnalyticsConfig({}), { enabled: false });
  assert.deepEqual(
    parseGoogleAnalyticsConfig({ NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-placeholder' }),
    { enabled: false },
  );
  assert.deepEqual(
    parseGoogleAnalyticsConfig({ NEXT_PUBLIC_GA_MEASUREMENT_ID: ' G-ABC123DEF4 ' }),
    { enabled: true, measurementId: 'G-ABC123DEF4' },
  );
});

test('GA4 synchronizes grant, revocation and regrant without duplicating initialization or page views', () => {
  const commands: unknown[][] = [];
  const runtime: AnalyticsRuntime = {
    dataLayer: [],
    gtag: (...args: unknown[]) => commands.push(args),
  };
  const config = parseGoogleAnalyticsConfig({
    NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-ABC123DEF4',
  });

  // Every update carries all four Consent Mode v2 signals.
  assert.equal(synchronizeGoogleAnalyticsConsent(runtime, config, ADS_GRANTED_ANALYTICS_DENIED), true);
  // An ad_storage grant must NOT activate GA4 (analytics_storage denied).
  assert.equal(initializeGoogleAnalytics(runtime, config, ADS_GRANTED_ANALYTICS_DENIED), false);
  assert.deepEqual(commands, [['consent', 'update', ADS_GRANTED_ANALYTICS_DENIED]]);
  assert.equal(runtime['ga-disable-G-ABC123DEF4'], true);

  // An analytics_storage grant activates GA4 without any ad_storage grant.
  assert.equal(initializeGoogleAnalytics(runtime, config, ANALYTICS_GRANTED_ADS_DENIED), true);
  assert.equal(initializeGoogleAnalytics(runtime, config, ANALYTICS_GRANTED_ADS_DENIED), true);
  assert.equal(runtime['ga-disable-G-ABC123DEF4'], false);
  assert.deepEqual(commands.map(([command]) => command), ['consent', 'consent', 'js', 'config']);
  assert.deepEqual(commands[1], ['consent', 'update', ANALYTICS_GRANTED_ADS_DENIED]);
  assert.deepEqual(commands[3], ['config', 'G-ABC123DEF4', { send_page_view: false }]);

  assert.equal(
    trackGoogleAnalyticsPageView(runtime, config, ANALYTICS_GRANTED_ADS_DENIED, 'https://oportuniape.com/convocatorias/uno?utm_source=test'),
    true,
  );
  assert.equal(
    trackGoogleAnalyticsPageView(runtime, config, ANALYTICS_GRANTED_ADS_DENIED, 'https://oportuniape.com/convocatorias/uno?utm_source=test'),
    false,
  );
  // ad_storage granted alone never produces a page view.
  assert.equal(
    trackGoogleAnalyticsPageView(runtime, config, ADS_GRANTED_ANALYTICS_DENIED, 'https://oportuniape.com/convocatorias/dos'),
    false,
  );
  assert.equal(
    trackGoogleAnalyticsPageView(runtime, config, ALL_DENIED, 'https://oportuniape.com/convocatorias/dos'),
    false,
  );
  assert.deepEqual(commands.map(([command]) => command), ['consent', 'consent', 'js', 'config', 'event']);

  assert.equal(synchronizeGoogleAnalyticsConsent(runtime, config, ALL_DENIED), true);
  assert.equal(runtime['ga-disable-G-ABC123DEF4'], true);
  assert.deepEqual(commands.at(-1), ['consent', 'update', ALL_DENIED]);
  assert.equal(
    trackGoogleAnalyticsPageView(runtime, config, ALL_DENIED, 'https://oportuniape.com/convocatorias/dos'),
    false,
  );

  assert.equal(synchronizeGoogleAnalyticsConsent(runtime, config, ALL_GRANTED), true);
  assert.equal(synchronizeGoogleAnalyticsConsent(runtime, config, ALL_GRANTED), true);
  assert.equal(runtime['ga-disable-G-ABC123DEF4'], false);
  assert.deepEqual(commands.at(-1), ['consent', 'update', ALL_GRANTED]);
  assert.equal(commands.filter(([command]) => command === 'consent').length, 4);
  assert.equal(initializeGoogleAnalytics(runtime, config, ALL_GRANTED), true);
  assert.equal(commands.filter(([command]) => command === 'config').length, 1);

  assert.equal(
    trackGoogleAnalyticsPageView(runtime, config, ALL_GRANTED, 'https://oportuniape.com/convocatorias/dos'),
    true,
  );
  assert.deepEqual(commands.at(-1), [
    'event',
    'page_view',
    {
      page_location: 'https://oportuniape.com/convocatorias/dos',
      page_path: '/convocatorias/dos',
    },
  ]);
});

test('GA4 initialization queues the consent update before js and config on a fresh runtime', () => {
  // A fresh runtime mirrors a real window: no dataLayer, no gtag stub yet.
  const runtime: AnalyticsRuntime = { dataLayer: [] };
  const config = parseGoogleAnalyticsConfig({
    NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-ABC123DEF4',
  });

  assert.equal(initializeGoogleAnalytics(runtime, config, ANALYTICS_GRANTED_ADS_DENIED), true);

  const queued = (runtime.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>));
  assert.deepEqual(queued.map(([command]) => command), ['consent', 'js', 'config']);
  assert.deepEqual(queued[0], ['consent', 'update', ANALYTICS_GRANTED_ADS_DENIED]);
  assert.equal(runtime['ga-disable-G-ABC123DEF4'], false);
});

test('GA4 consent lifecycle is a no-op without a valid measurement ID', () => {
  const commands: unknown[][] = [];
  const runtime: AnalyticsRuntime = {
    dataLayer: [],
    gtag: (...args: unknown[]) => commands.push(args),
  };

  assert.equal(synchronizeGoogleAnalyticsConsent(runtime, { enabled: false }, ALL_GRANTED), false);
  assert.equal(synchronizeGoogleAnalyticsConsent(runtime, { enabled: true, measurementId: 'invalid' }, ALL_DENIED), false);
  assert.deepEqual(commands, []);
  assert.equal(Object.keys(runtime).some((key) => key.startsWith('ga-disable-')), false);
});

test('GA4 client uses one conditional Next Script and App Router navigation signals', () => {
  const client = readFileSync('src/lib/site/analytics-client.tsx', 'utf8');
  assert.equal(GA4_SCRIPT_ID, 'oportunia-ga4');
  // GA4 must subscribe to the analytics purpose hook, never the ad consent hook.
  assert.match(client, /useAnalyticsConsent/);
  assert.doesNotMatch(client, /useAdvertisingConsent/);
  assert.match(client, /useConsentPurposes/);
  assert.match(client, /usePathname/);
  assert.match(client, /useSearchParams/);
  assert.match(client, /id=\{GA4_SCRIPT_ID\}/);
  assert.match(client, /googletagmanager\.com\/gtag\/js\?id=/);
  assert.match(client, /consent !== ["']granted["']/);
});

test('analytics follows analytics_storage while ad slots follow ad_storage', () => {
  const adsenseClient = readFileSync('src/lib/site/adsense-client.tsx', 'utf8');
  assert.match(adsenseClient, /export function useAnalyticsConsent/);
  assert.match(adsenseClient, /export function useConsentPurposes/);
  assert.match(adsenseClient, /parseConsentPurposes/);

  const config = parseGoogleAnalyticsConfig({ NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-ABC123DEF4' });
  const adConfig: AdsenseConfig = {
    enabled: true,
    publisherId: 'pub-1234567890123456',
    clientId: 'ca-pub-1234567890123456',
    slots: { 'catalog-end': '1234567890' },
  };

  // Analytics-only grant: GA4 activates, the ad slot stays closed.
  const analyticsRuntime: AnalyticsRuntime = { dataLayer: [], gtag: () => {} };
  assert.equal(initializeGoogleAnalytics(analyticsRuntime, config, ANALYTICS_GRANTED_ADS_DENIED), true);
  assert.equal(analyticsRuntime['ga-disable-G-ABC123DEF4'], false);
  assert.equal(
    canRenderAd(adConfig, buildConsentDetail(ANALYTICS_GRANTED_ADS_DENIED).status, 'catalog-end'),
    false,
  );

  // Advertising-only grant: the ad slot opens, GA4 stays inactive.
  const adsRuntime: AnalyticsRuntime = { dataLayer: [], gtag: () => {} };
  assert.equal(initializeGoogleAnalytics(adsRuntime, config, ADS_GRANTED_ANALYTICS_DENIED), false);
  assert.equal(adsRuntime['ga-disable-G-ABC123DEF4'], undefined);
  assert.equal(
    canRenderAd(adConfig, buildConsentDetail(ADS_GRANTED_ANALYTICS_DENIED).status, 'catalog-end'),
    true,
  );
});

test('expired, closed and otherwise ineligible opportunities are noindex without losing canonical', () => {
  const now = new Date('2026-09-20T17:00:00.000Z');

  const active = buildOpportunityMetadata(opportunity(), now);
  assert.deepEqual(active.robots, { index: true, follow: true });
  assert.equal(active.alternates?.canonical, '/convocatorias/analista-publico');

  const expired = buildOpportunityMetadata(
    opportunity({ slug: 'analista-vencido', closingDate: '2026-09-19' }),
    now,
  );
  assert.deepEqual(expired.robots, { index: false, follow: false });
  assert.equal(expired.alternates?.canonical, '/convocatorias/analista-vencido');

  const closed = buildOpportunityMetadata(
    opportunity({ slug: 'analista-cerrado', status: 'closed' }),
    now,
  );
  assert.deepEqual(closed.robots, { index: false, follow: false });
  assert.equal(closed.alternates?.canonical, '/convocatorias/analista-cerrado');

  const demo = buildOpportunityMetadata(
    opportunity({ slug: 'analista-demo', isDemo: true }),
    now,
  );
  assert.deepEqual(demo.robots, { index: false, follow: false });
  assert.equal(demo.alternates?.canonical, '/convocatorias/analista-demo');
});

test('GA4 deployment stays explicit and external responsibilities remain documented', () => {
  const environment = readFileSync('.env.example', 'utf8');
  const runbook = readFileSync('docs/production-readiness.md', 'utf8');
  assert.match(environment, /^NEXT_PUBLIC_GA_MEASUREMENT_ID=$/m);
  assert.doesNotMatch(environment, /^NEXT_PUBLIC_GA_MEASUREMENT_ID=G-/m);
  assert.match(runbook, /propiedad de GA4/i);
  assert.match(runbook, /GA4.*AdSense|AdSense.*GA4/i);
  assert.match(runbook, /CMP certificada/i);
});
