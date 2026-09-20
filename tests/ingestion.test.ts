import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deduplicateMappedRows,
  mapIngestionRow,
  normalizeOfficialUrl,
} from '../src/lib/ingestion/rows';
import { fetchApprovedGobPeSource, isSpecificGobPeUrl } from '../src/lib/ingestion/gob-pe';
import { createOpportunityTemplate, parseOpportunityWorkbook } from '../src/lib/ingestion/excel';

test('maps a complete spreadsheet row into an editorial draft with provenance', () => {
  const result = mapIngestionRow(
    {
      Entidad: 'Ministerio de Educación',
      Título: 'Especialista administrativo',
      'URL oficial': 'https://www.gob.pe/institucion/minedu/institucional',
      Región: 'Lima',
      Vacantes: '2',
    },
    { rowNumber: 2, sourceKind: 'excel', capturedAt: '2026-09-19T12:00:00.000Z' },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.opportunity.status, 'draft');
  assert.equal(result.opportunity.entity, 'Ministerio de Educación');
  assert.equal(result.opportunity.vacancies, 2);
  assert.equal(result.provenance.originalOfficialUrl, 'https://www.gob.pe/institucion/minedu/institucional');
  assert.equal(result.provenance.normalizedOfficialUrl, 'https://www.gob.pe/institucion/minedu/institucional');
});

test('reports row-level errors when spreadsheet required fields are absent or invalid', () => {
  const result = mapIngestionRow(
    { Entidad: '  ', Título: '', 'URL oficial': 'not a url' },
    { rowNumber: 7, sourceKind: 'excel' },
  );

  assert.deepEqual(result, {
    ok: false,
    rowNumber: 7,
    errors: ['Entidad es obligatoria.', 'Título es obligatorio.', 'URL oficial no es válida.'],
  });
});

test('normalizes official URLs and skips duplicate values already persisted or repeated in a file', () => {
  assert.equal(
    normalizeOfficialUrl('HTTPS://WWW.GOB.PE/convocatorias/123/?utm_source=correo#detalle'),
    'https://www.gob.pe/convocatorias/123',
  );

  const first = mapIngestionRow(
    { Entidad: 'Entidad', Título: 'Uno', 'URL oficial': 'https://www.gob.pe/convocatorias/1/' },
    { rowNumber: 2, sourceKind: 'excel' },
  );
  const repeated = mapIngestionRow(
    { Entidad: 'Entidad', Título: 'Dos', 'URL oficial': 'https://www.gob.pe/convocatorias/1#bases' },
    { rowNumber: 3, sourceKind: 'excel' },
  );
  const existing = mapIngestionRow(
    { Entidad: 'Entidad', Título: 'Tres', 'URL oficial': 'https://www.gob.pe/convocatorias/2' },
    { rowNumber: 4, sourceKind: 'excel' },
  );

  assert.equal(first.ok, true);
  assert.equal(repeated.ok, true);
  assert.equal(existing.ok, true);
  if (!first.ok || !repeated.ok || !existing.ok) return;

  const result = deduplicateMappedRows([first, repeated, existing], ['https://www.gob.pe/convocatorias/2/']);
  assert.deepEqual(result.accepted.map((item) => item.rowNumber), [2]);
  assert.deepEqual(result.duplicates, [
    { rowNumber: 3, normalizedOfficialUrl: 'https://www.gob.pe/convocatorias/1', reason: 'batch' },
    { rowNumber: 4, normalizedOfficialUrl: 'https://www.gob.pe/convocatorias/2', reason: 'existing' },
  ]);
});

test('gob.pe adapter only fetches enabled, concrete gob.pe URLs and refuses broad domain crawling', async () => {
  assert.equal(isSpecificGobPeUrl('https://www.gob.pe/'), false);
  assert.equal(isSpecificGobPeUrl('https://example.com/convocatorias'), false);
  assert.equal(isSpecificGobPeUrl('https://www.gob.pe/institucion/minedu'), true);

  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response('<html></html>', { status: 200 });
  };

  await assert.rejects(
    () => fetchApprovedGobPeSource({ id: 'all-gob-pe', url: 'https://www.gob.pe/', enabled: true }, fetcher),
    /URL específica/i,
  );
  await assert.rejects(
    () => fetchApprovedGobPeSource({ id: 'disabled', url: 'https://www.gob.pe/institucion/minedu', enabled: false }, fetcher),
    /deshabilitada/i,
  );
  await fetchApprovedGobPeSource({ id: 'minedu', url: 'https://www.gob.pe/institucion/minedu', enabled: true }, fetcher);

  assert.deepEqual(calls.map((call) => call.url), ['https://www.gob.pe/institucion/minedu']);
  assert.equal(calls[0]?.init?.redirect, 'error');
});

test('workbook parser retains spreadsheet row numbers and the template exposes required headers', () => {
  const template = createOpportunityTemplate();
  const parsed = parseOpportunityWorkbook(template);

  assert.deepEqual(parsed.headers.slice(0, 3), ['Entidad', 'Título', 'URL oficial']);
  assert.equal(parsed.rows.length, 0);
});
