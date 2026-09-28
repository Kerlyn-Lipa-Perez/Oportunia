import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildTikTokDetailHref,
  selectPublicTikTokCampaigns,
} from '../src/app/tiktok/model';
import {
  buildJobPostingJsonLd,
  serializeJsonLd,
} from '../src/components/opportunity-job-posting';
import type { Opportunity, SocialCampaign } from '../src/lib/types';

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
    salary: 'S/ 3,500',
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
    script: 'Revisá requisitos y fecha en Oportunia.',
    coverText: '2 vacantes en datos',
    caption: 'Revisá la ficha y la fuente oficial.',
    publishedUrl: 'https://www.tiktok.com/@oportunia/video/123456789',
    publishedAt: '2026-09-19T12:00:00.000Z',
    status: 'published',
    reviewer: 'editor@example.com',
    approvedAt: '2026-09-19T11:30:00.000Z',
    failureReason: null,
    createdAt: '2026-09-19T10:00:00.000Z',
    updatedAt: '2026-09-19T12:00:00.000Z',
    ...overrides,
  };
}

test('TikTok detail links preserve the exact organic attribution contract', () => {
  assert.equal(
    buildTikTokDetailHref('analista-datos-opp-1', 'tt-analista-datos-a1b2c3d4'),
    '/convocatorias/analista-datos-opp-1?utm_source=tiktok&utm_medium=organic_social&utm_campaign=convocatorias&utm_content=tt-analista-datos-a1b2c3d4',
  );
});

test('TikTok landing only exposes published campaigns with current reviewed opportunities', () => {
  const eligible = opportunity();
  const opportunities = [
    eligible,
    opportunity({ id: 'opp-demo', slug: 'demo', isDemo: true }),
    opportunity({ id: 'opp-draft', slug: 'draft', status: 'draft' }),
    opportunity({ id: 'opp-unverified', slug: 'unverified', verifiedAt: '', verifiedBy: '' }),
    opportunity({ id: 'opp-expired', slug: 'expired', closingDate: '2026-09-19' }),
  ];
  const campaigns = [
    campaign(),
    campaign({ id: 'campaign-demo', opportunityId: 'opp-demo' }),
    campaign({ id: 'campaign-draft-opportunity', opportunityId: 'opp-draft' }),
    campaign({ id: 'campaign-unverified', opportunityId: 'opp-unverified' }),
    campaign({ id: 'campaign-expired', opportunityId: 'opp-expired' }),
    campaign({ id: 'campaign-queued', status: 'queued' }),
  ];

  const result = selectPublicTikTokCampaigns(campaigns, opportunities, now);
  assert.deepEqual(result.map((item) => item.campaign.id), ['campaign-1']);
  assert.equal(result[0]?.opportunity.id, eligible.id);
});

test('JobPosting is emitted only for complete, current, reviewed jobs', () => {
  const jsonLd = buildJobPostingJsonLd(opportunity(), 'https://oportuniape.com', now);
  assert.equal(jsonLd?.['@type'], 'JobPosting');
  assert.equal(
    jsonLd?.description,
    'Convocatoria para analistas de datos. Requisitos: Título profesional. Antes de postular: Revisá las bases oficiales.',
  );
  assert.equal(jsonLd?.url, 'https://www.gob.pe/entidad/convocatoria');
  assert.equal(jsonLd?.validThrough, '2026-10-20T23:59:59-05:00');
  assert.deepEqual(jsonLd?.hiringOrganization, { '@type': 'Organization', name: 'Entidad Pública' });
  assert.deepEqual(jsonLd?.jobLocation, {
    '@type': 'Place',
    address: { '@type': 'PostalAddress', addressLocality: 'Lima', addressCountry: 'PE' },
  });
  assert.deepEqual(jsonLd?.baseSalary, {
    '@type': 'MonetaryAmount',
    currency: 'PEN',
    value: { '@type': 'QuantitativeValue', value: 3500 },
  });

  assert.equal(buildJobPostingJsonLd(opportunity({ type: 'Becas y programas' }), 'https://oportuniape.com', now), null);
  assert.equal(buildJobPostingJsonLd(opportunity({ closingDate: '2026-09-19' }), 'https://oportuniape.com', now), null);
  assert.equal(buildJobPostingJsonLd(opportunity({ verifiedAt: '' }), 'https://oportuniape.com', now), null);
  assert.equal(buildJobPostingJsonLd(opportunity({ isDemo: true }), 'https://oportuniape.com', now), null);
});

test('JobPosting description is readable and reflects all relevant visible application content', () => {
  const jsonLd = buildJobPostingJsonLd(opportunity({
    summary: '  Convocatoria\npara analistas.  ',
    requirements: [' Título profesional ', 'Experiencia\ncomprobada'],
    beforeApplying: '  Revisá   el cronograma. ',
  }), 'https://oportuniape.com', now);

  assert.equal(
    jsonLd?.description,
    'Convocatoria para analistas. Requisitos: Título profesional; Experiencia comprobada. Antes de postular: Revisá el cronograma.',
  );
});

test('JobPosting marks only remote roles as TELECOMMUTE', () => {
  const nationalOnSite = buildJobPostingJsonLd(opportunity({
    modality: 'Presencial',
    region: 'A nivel nacional',
  }), 'https://oportuniape.com', now);
  assert.equal(nationalOnSite?.jobLocationType, undefined);
  assert.deepEqual(nationalOnSite?.jobLocation, {
    '@type': 'Place',
    address: { '@type': 'PostalAddress', addressLocality: 'A nivel nacional', addressCountry: 'PE' },
  });

  const remote = buildJobPostingJsonLd(opportunity({
    modality: 'Remoto',
    region: 'A nivel nacional',
  }), 'https://oportuniape.com', now);
  assert.equal(remote?.jobLocationType, 'TELECOMMUTE');
  assert.deepEqual(remote?.applicantLocationRequirements, { '@type': 'Country', name: 'Peru' });
  assert.equal(remote?.jobLocation, undefined);
});

test('JSON-LD serialization neutralizes HTML tag starts', () => {
  const jsonLd = buildJobPostingJsonLd(opportunity({ title: '</script><script>alert(1)</script>' }), 'https://oportuniape.com', now);
  const serialized = serializeJsonLd(jsonLd!);
  assert.doesNotMatch(serialized, /</);
  assert.match(serialized, /\\u003c\/script>/);
});

test('admin and attribution UI wire every required endpoint and editorial field', () => {
  const campanas = readFileSync('src/app/admin/campanas/page.tsx', 'utf8');
  const social = readFileSync('src/app/admin/social-campaigns.tsx', 'utf8');
  const detail = readFileSync('src/app/convocatorias/[slug]/page.tsx', 'utf8');
  const landing = readFileSync('src/app/tiktok/page.tsx', 'utf8');
  const tracker = readFileSync('src/components/attribution-tracker.tsx', 'utf8');

  assert.match(campanas, /SocialCampaignsPanel/);
  assert.match(social, /\/api\/admin\/social-campaigns\/analytics/);
  assert.match(social, /method:\s*'POST'/);
  assert.match(social, /method:\s*'PATCH'/);
  for (const field of ['hook', 'script', 'coverText', 'caption']) assert.match(social, new RegExp(field));
  for (const status of ['approved', 'queued', 'published', 'failed']) assert.match(social, new RegExp(status));
  assert.match(detail, /name="detail_view"/);
  assert.match(landing, /name="landing_view"/);
  assert.match(tracker, /utm_source/);
  assert.match(tracker, /keepalive:\s*true/);
});

test('admin login button says only Ingresar and never mentions CMS', () => {
  const login = readFileSync('src/app/admin/login.tsx', 'utf8');

  assert.match(login, /'Ingresar'/);
  assert.doesNotMatch(login, /Ingresar al CMS/);
});

test('TikTok route keeps data failures distinct from the genuine empty state', () => {
  const errorBoundary = readFileSync('src/app/tiktok/error.tsx', 'utf8');

  assert.match(errorBoundary, /^'use client';/);
  assert.match(errorBoundary, /role="alert"/);
  assert.match(errorBoundary, /retry\(\)/);
  assert.doesNotMatch(errorBoundary, /42P01|entries\s*=\s*\[\]|return\s+\[\]/);
});
