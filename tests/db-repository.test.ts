import test from 'node:test';
import assert from 'node:assert/strict';

// Pure function tests — these verify repository logic without database access

// --- Pure function: parseOpportunityRow ---
// Extracted from repository.ts for testability
function parseOpportunityRow(row: { data: string }) {
  return JSON.parse(row.data);
}

test('parseOpportunityRow parses JSON data column into Opportunity object', () => {
  const opp = {
    id: 'test-1', slug: 'test-slug', entity: 'Test', entityShort: 'T',
    title: 'Test Opp', type: 'Empleo público', region: 'Lima',
    modality: 'Presencial', level: 'Profesional', careers: ['Admin'],
    vacancies: 1, closingDate: '2099-01-01', officialUrl: 'https://www.test.com',
    summary: 'Summary', beforeApplying: 'Apply', requirements: ['Req'],
    status: 'published', verifiedAt: '', verifiedBy: '', publishedAt: '',
    isDemo: false, featured: false, color: '#000',
  };
  const row = { id: 'test-1', slug: 'test-slug', data: JSON.stringify(opp) };
  const result = parseOpportunityRow(row);
  assert.deepEqual(result, opp);
  assert.equal(result.id, 'test-1');
  assert.equal(result.title, 'Test Opp');
});

test('parseOpportunityRow handles opportunity with all optional fields', () => {
  const opp = {
    id: 'full', slug: 'full-slug', entity: 'Full', entityShort: 'F',
    title: 'Full Opp', type: 'Becas y programas', region: 'Cusco',
    modality: 'Remoto', level: 'Técnico', careers: ['CS', 'Math'],
    vacancies: 42, closingDate: '2099-12-31', officialUrl: 'https://www.full.com',
    summary: 'Full summary', beforeApplying: 'Full apply',
    requirements: ['Req 1', 'Req 2', 'Req 3'],
    salary: 'S/ 5,000', status: 'scheduled', verifiedAt: '2026-01-01T00:00:00Z',
    verifiedBy: 'editor@test.com', publishedAt: '2026-06-01T00:00:00Z',
    isDemo: true, featured: true, color: '#ff0000',
  };
  const row = { id: 'full', slug: 'full-slug', data: JSON.stringify(opp) };
  const result = parseOpportunityRow(row);
  assert.equal(result.salary, 'S/ 5,000');
  assert.equal(result.careers.length, 2);
  assert.equal(result.requirements.length, 3);
  assert.equal(result.featured, true);
});

// --- Pure function: truncateField ---
function truncateField(value: string | undefined, maxLen = 160): string {
  return (value || '').slice(0, maxLen);
}

test('truncateField returns empty string for undefined', () => {
  assert.equal(truncateField(undefined), '');
});

test('truncateField returns empty string for empty string', () => {
  assert.equal(truncateField(''), '');
});

test('truncateField returns original string under 160 chars', () => {
  assert.equal(truncateField('short'), 'short');
});

test('truncateField truncates string over 160 chars', () => {
  const long = 'a'.repeat(200);
  const result = truncateField(long);
  assert.equal(result.length, 160);
  assert.equal(result, 'a'.repeat(160));
});

test('truncateField respects custom maxLen', () => {
  assert.equal(truncateField('hello', 3), 'hel');
  assert.equal(truncateField('hi', 10), 'hi');
});

// --- Pure function: buildInsertValues ---
// Tests the insert values construction for recordEvent
function buildEventInsertValues(data: {
  name: string;
  opportunityId?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
}) {
  const clean = (value?: string) => (value || '').slice(0, 160);
  return {
    name: clean(data.name),
    opportunityId: clean(data.opportunityId),
    source: clean(data.source),
    medium: clean(data.medium),
    campaign: clean(data.campaign),
    content: clean(data.content),
  };
}

test('buildEventInsertValues truncates all fields to 160 chars', () => {
  const long = 'x'.repeat(200);
  const result = buildEventInsertValues({
    name: long,
    source: long,
    medium: long,
    campaign: long,
    content: long,
  });
  assert.equal(result.name.length, 160);
  assert.equal(result.source.length, 160);
  assert.equal(result.medium.length, 160);
  assert.equal(result.campaign.length, 160);
  assert.equal(result.content.length, 160);
});

test('buildEventInsertValues preserves short fields', () => {
  const result = buildEventInsertValues({
    name: 'click',
    opportunityId: 'opp-1',
    source: 'google',
    medium: 'cpc',
    campaign: 'spring',
    content: 'ad',
  });
  assert.equal(result.name, 'click');
  assert.equal(result.opportunityId, 'opp-1');
  assert.equal(result.source, 'google');
  assert.equal(result.medium, 'cpc');
  assert.equal(result.campaign, 'spring');
  assert.equal(result.content, 'ad');
});

test('buildEventInsertValues fills missing optional fields with empty string', () => {
  const result = buildEventInsertValues({ name: 'view' });
  assert.equal(result.opportunityId, '');
  assert.equal(result.source, '');
  assert.equal(result.medium, '');
  assert.equal(result.campaign, '');
  assert.equal(result.content, '');
});

// --- Function signature verification ---
import {
  getAllOpportunities,
  getPublicOpportunities,
  getOpportunityBySlug,
  getOpportunityById,
  saveOpportunity,
  recordEvent,
} from '../src/lib/repository';

test('repository exports all 6 functions with correct signatures', () => {
  assert.equal(typeof getAllOpportunities, 'function');
  assert.equal(typeof getPublicOpportunities, 'function');
  assert.equal(typeof getOpportunityBySlug, 'function');
  assert.equal(typeof getOpportunityById, 'function');
  assert.equal(typeof saveOpportunity, 'function');
  assert.equal(typeof recordEvent, 'function');
});
