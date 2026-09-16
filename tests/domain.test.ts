import test from 'node:test';
import assert from 'node:assert/strict';
import { getDeadline, validateOpportunity, isPublicOpportunity } from '../src/lib/opportunities';

test('deadline uses calendar days in Lima and closes after the closing day', () => {
  assert.deepEqual(getDeadline('2026-09-16', new Date('2026-09-17T02:00:00Z')), { label: 'Cierra hoy', days: 0, closed: false, urgent: true });
  assert.equal(getDeadline('2026-09-16', new Date('2026-09-17T05:00:00Z')).closed, true);
  assert.equal(getDeadline('2026-09-19', new Date('2026-09-16T12:00:00Z')).label, 'Cierra en 3 días');
});

test('publication requires trustworthy source and accountable editorial verification', () => {
  const errors = validateOpportunity({ status: 'published', closingDate: '2099-10-10', officialUrl: 'javascript:alert(1)' });
  assert.ok(errors.some((e) => e.includes('URL')));
  assert.ok(errors.some((e) => e.includes('responsable')));
  assert.ok(errors.some((e) => e.includes('entidad')));
});

test('past dates cannot publish and invalid dates do not pass', () => {
  assert.ok(validateOpportunity({ status: 'published', closingDate: '2020-01-01' }).some((e) => e.includes('vencida')));
  assert.ok(validateOpportunity({ status: 'draft', closingDate: '2026-02-31' }).some((e) => e.includes('fecha')));
});

test('drafts and future scheduled entries never become public', () => {
  assert.equal(isPublicOpportunity({ status: 'draft' }), false);
  assert.equal(isPublicOpportunity({ status: 'scheduled', publishedAt: '2099-01-01T00:00:00Z' }), false);
  assert.equal(isPublicOpportunity({ status: 'scheduled', publishedAt: '2020-01-01T00:00:00Z' }), true);
  assert.equal(isPublicOpportunity({ status: 'closed' }), true);
});

test('closed public entries still require editorial integrity', () => {
  const errors = validateOpportunity({ status: 'closed', entity: 'Entidad', title: 'Puesto' });
  assert.ok(errors.some((e) => e.includes('URL')));
  assert.ok(errors.some((e) => e.includes('responsable')));
});

test('valid public records can be published and closed after expiration', () => {
  const valid = { entity: 'Entidad', title: 'Analista', type: 'Empleo público' as const, modality: 'Presencial' as const, level: 'Profesional', officialUrl: 'https://www.gob.pe/entidad', closingDate: '2099-01-01', verifiedBy: 'editor@example.com', region: 'Lima', careers: ['Administración'], vacancies: 1, summary: 'Perfil administrativo.', beforeApplying: 'Revisa las bases.' };
  assert.deepEqual(validateOpportunity({ ...valid, status: 'published' }), []);
  assert.deepEqual(validateOpportunity({ ...valid, status: 'closed', closingDate: '2020-01-01' }), []);
  assert.ok(validateOpportunity({ ...valid, status: 'scheduled', publishedAt: 'invalid' }).length);
  assert.ok(validateOpportunity({ ...valid, status: '' as never }).length);
});
