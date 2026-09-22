import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applySocialCampaignTransition,
  buildSocialCampaignDraft,
  evaluateAdsenseRequestGate,
  validateSocialCampaignOpportunity,
} from '../src/lib/repository';
import { isTrackableEventName, type Opportunity, type SocialCampaign } from '../src/lib/types';

const now = new Date('2026-09-20T12:00:00.000Z');

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opp-1',
    slug: 'analista-datos-opp-1',
    entity: 'Entidad Pública',
    entityShort: 'EP',
    title: 'Analista de datos',
    type: 'Empleo público',
    region: 'Lima',
    modality: 'Híbrido',
    level: 'Profesional',
    careers: ['Ingeniería de Sistemas'],
    vacancies: 2,
    closingDate: '2026-10-20',
    officialUrl: 'https://www.gob.pe/entidad/convocatoria',
    summary: 'Convocatoria para analistas de datos.',
    beforeApplying: 'Revisá las bases oficiales.',
    requirements: ['Título profesional'],
    status: 'published',
    verifiedAt: '2026-09-19T10:00:00.000Z',
    verifiedBy: 'editor@example.com',
    publishedAt: '2026-09-19T11:00:00.000Z',
    isDemo: false,
    featured: false,
    color: '#245be8',
    ...overrides,
  };
}

function campaign(overrides: Partial<SocialCampaign> = {}): SocialCampaign {
  return {
    id: 'campaign-1',
    opportunityId: 'opp-1',
    platform: 'tiktok',
    code: 'tt-analista-datos-a1b2c3d4',
    hook: '¿Buscás una oportunidad en datos?',
    script: 'La entidad abrió dos vacantes. Revisá requisitos y fecha en Oportunia.',
    coverText: '2 vacantes en datos',
    caption: 'Revisá la ficha completa y la fuente oficial.',
    publishedUrl: null,
    publishedAt: null,
    status: 'draft',
    reviewer: null,
    approvedAt: null,
    failureReason: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

test('event validation preserves existing events and accepts attribution funnel and engagement events', () => {
  for (const name of ['view', 'official_click', 'save', 'landing_view', 'detail_view', 'engagement']) {
    assert.equal(isTrackableEventName(name), true, `${name} should be trackable`);
  }
  assert.equal(isTrackableEventName('email'), false);
  assert.equal(isTrackableEventName(42), false);
});

test('social campaign eligibility requires a published, verified, current, non-demo opportunity', () => {
  assert.deepEqual(validateSocialCampaignOpportunity(opportunity(), now), []);
  assert.ok(validateSocialCampaignOpportunity(opportunity({ status: 'scheduled' }), now).some((error) => error.includes('publicada')));
  assert.ok(validateSocialCampaignOpportunity(opportunity({ verifiedAt: '' }), now).some((error) => error.includes('verificada')));
  assert.ok(validateSocialCampaignOpportunity(opportunity({ isDemo: true }), now).some((error) => error.includes('demo')));
  assert.ok(validateSocialCampaignOpportunity(opportunity({ closingDate: '2026-09-19' }), now).some((error) => error.includes('vencida')));
});

test('draft generation uses the reviewed opportunity and a stable video code', () => {
  const draft = buildSocialCampaignDraft(
    opportunity(),
    { id: 'campaign-1', code: 'tt-analista-datos-a1b2c3d4' },
    now,
  );

  assert.equal(draft.opportunityId, 'opp-1');
  assert.equal(draft.platform, 'tiktok');
  assert.equal(draft.status, 'draft');
  assert.equal(draft.code, 'tt-analista-datos-a1b2c3d4');
  assert.match(draft.hook, /Analista de datos/);
  assert.match(draft.script, /Entidad Pública/);
  assert.match(draft.caption, /fuente oficial/i);
});

test('campaign workflow is forward-only and records editorial approval', () => {
  const approved = applySocialCampaignTransition(campaign(), 'approved', {
    actor: 'admin@example.com',
    opportunity: opportunity(),
    now,
  });
  assert.equal(approved.status, 'approved');
  assert.equal(approved.reviewer, 'admin@example.com');
  assert.equal(approved.approvedAt, now.toISOString());

  const queued = applySocialCampaignTransition(approved, 'queued', {
    actor: 'admin@example.com',
    opportunity: opportunity(),
    now: new Date('2026-09-21T12:00:00.000Z'),
  });
  assert.equal(queued.status, 'queued');

  const published = applySocialCampaignTransition(queued, 'published', {
    actor: 'admin@example.com',
    opportunity: opportunity(),
    publishedUrl: 'https://www.tiktok.com/@oportunia/video/123456789',
    now: new Date('2026-09-22T12:00:00.000Z'),
  });
  assert.equal(published.status, 'published');
  assert.equal(published.publishedAt, '2026-09-22T12:00:00.000Z');
  assert.equal(published.publishedUrl, 'https://www.tiktok.com/@oportunia/video/123456789');

  assert.throws(
    () => applySocialCampaignTransition(campaign(), 'queued', { actor: 'admin@example.com', opportunity: opportunity(), now }),
    /Transición no válida/,
  );
});

test('approval rejects incomplete content and queue rechecks opportunity eligibility', () => {
  assert.throws(
    () => applySocialCampaignTransition(campaign({ hook: '' }), 'approved', {
      actor: 'admin@example.com',
      opportunity: opportunity(),
      now,
    }),
    /hook/i,
  );

  assert.throws(
    () => applySocialCampaignTransition(campaign({ status: 'approved' }), 'queued', {
      actor: 'admin@example.com',
      opportunity: opportunity({ closingDate: '2026-09-19' }),
      now,
    }),
    /vencida/,
  );
});

test('publishing rechecks opportunity eligibility after the campaign was queued', () => {
  const queuedCampaign = campaign({ status: 'queued' });
  const publishContext = {
    actor: 'admin@example.com',
    publishedUrl: 'https://www.tiktok.com/@oportunia/video/123456789',
    now,
  };

  assert.throws(
    () => applySocialCampaignTransition(queuedCampaign, 'published', {
      ...publishContext,
      opportunity: opportunity({ closingDate: '2026-09-19' }),
    }),
    /vencida/,
  );

  assert.throws(
    () => applySocialCampaignTransition(queuedCampaign, 'published', {
      ...publishContext,
      opportunity: opportunity({ status: 'scheduled' }),
    }),
    /publicada/,
  );
});

test('publishing requires a public TikTok URL and failure captures a reason', () => {
  assert.throws(
    () => applySocialCampaignTransition(campaign({ status: 'queued' }), 'published', {
      actor: 'admin@example.com',
      opportunity: opportunity(),
      publishedUrl: 'http://localhost/video/1',
      now,
    }),
    /TikTok/i,
  );

  const failed = applySocialCampaignTransition(campaign({ status: 'queued' }), 'failed', {
    actor: 'admin@example.com',
    opportunity: opportunity(),
    failureReason: 'El video fue rechazado por la plataforma.',
    now,
  });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.failureReason, 'El video fue rechazado por la plataforma.');
});

test('AdSense request gate reports every unmet threshold without inventing guide persistence', () => {
  const ready = evaluateAdsenseRequestGate({
    publishedDemoCount: 0,
    activeVerifiedOpportunityCount: 30,
    originalGuideCount: 10,
    measuredDays: 14,
    hasAnalyticsAnomaly: false,
    homeReady: true,
    seoReady: true,
    legalReady: true,
    configurationReady: true,
  });
  assert.equal(ready.eligible, true);
  assert.deepEqual(ready.blockers, []);

  const blocked = evaluateAdsenseRequestGate({
    publishedDemoCount: 1,
    activeVerifiedOpportunityCount: 29,
    originalGuideCount: 9,
    measuredDays: 13,
    hasAnalyticsAnomaly: true,
    homeReady: false,
    seoReady: false,
    legalReady: false,
    configurationReady: false,
  });
  assert.equal(blocked.eligible, false);
  assert.equal(blocked.blockers.length, 9);
  assert.equal(blocked.checks.activeVerifiedOpportunities.passed, false);
  assert.equal(blocked.checks.originalGuides.required, 10);
});
