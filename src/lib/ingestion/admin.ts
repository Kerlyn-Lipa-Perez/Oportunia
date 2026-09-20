import { createIngestedDraft, findExistingNormalizedOfficialUrls, getApprovedSources, startIngestionRun, completeIngestionRun } from '../repository';
import { fetchApprovedGobPeSource } from './gob-pe';
import { deduplicateMappedRows, normalizeOfficialUrl, type IngestionRowResult } from './rows';
import { parseAndMapOpportunityWorkbook } from './excel';

export interface IngestionPreview {
  valid: number;
  invalid: number;
  duplicates: number;
  issues: Array<{ rowNumber: number; errors?: string[]; reason?: 'existing' | 'batch'; normalizedOfficialUrl?: string }>;
}

function splitRows(rows: IngestionRowResult[]) {
  const valid = rows.filter((row): row is Extract<IngestionRowResult, { ok: true }> => row.ok);
  const invalid = rows.filter((row): row is Extract<IngestionRowResult, { ok: false }> => !row.ok);
  return { valid, invalid };
}

export async function previewExcelImport(input: ArrayBuffer | Uint8Array): Promise<IngestionPreview> {
  const { valid, invalid } = splitRows(parseAndMapOpportunityWorkbook(input, { sourceKind: 'excel', capturedAt: new Date().toISOString() }));
  const existing = await findExistingNormalizedOfficialUrls(valid.map((row) => row.provenance.normalizedOfficialUrl));
  const { accepted, duplicates } = deduplicateMappedRows(valid, existing);
  return {
    valid: accepted.length,
    invalid: invalid.length,
    duplicates: duplicates.length,
    issues: [
      ...invalid.map((row) => ({ rowNumber: row.rowNumber, errors: row.errors })),
      ...duplicates.map((row) => ({ rowNumber: row.rowNumber, reason: row.reason, normalizedOfficialUrl: row.normalizedOfficialUrl })),
    ],
  };
}

export async function confirmExcelImport(input: ArrayBuffer | Uint8Array) {
  const run = await startIngestionRun({ trigger: 'excel' });
  try {
    const { valid, invalid } = splitRows(parseAndMapOpportunityWorkbook(input, { sourceKind: 'excel', ingestionRunId: run.id, capturedAt: new Date().toISOString() }));
    const existing = await findExistingNormalizedOfficialUrls(valid.map((row) => row.provenance.normalizedOfficialUrl));
    const { accepted, duplicates } = deduplicateMappedRows(valid, existing);
    let imported = 0;
    let duplicateCount = duplicates.length;
    for (const row of accepted) {
      const result = await createIngestedDraft({ opportunity: row.opportunity, provenance: row.provenance });
      if (result.created) imported++;
      else duplicateCount++;
    }
    await completeIngestionRun({ id: run.id, status: 'completed', importedCount: imported, invalidCount: invalid.length, duplicateCount });
    return { imported, invalid: invalid.length, duplicates: duplicateCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo importar el archivo.';
    await completeIngestionRun({ id: run.id, status: 'failed', importedCount: 0, invalidCount: 0, duplicateCount: 0, error: message });
    throw error;
  }
}

function htmlMetadata(html: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'))
    ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i'));
  return match?.[1]?.replace(/&amp;/g, '&').trim() ?? '';
}

function textTitle(html: string): string {
  return htmlMetadata(html, 'og:title') || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || '';
}

/** Fetches only enabled concrete gob.pe pages and stores one reviewable draft per source URL. */
export async function runApprovedSources(trigger: 'manual' | 'cron') {
  const sources = (await getApprovedSources()).filter((source) => source.enabled && source.kind === 'gob-pe');
  let imported = 0;
  let invalid = 0;
  let duplicates = 0;
  const errors: string[] = [];
  for (const source of sources) {
    const run = await startIngestionRun({ sourceId: source.id, trigger });
    try {
      const response = await fetchApprovedGobPeSource(source);
      if (!response.ok) throw new Error(`La fuente respondió ${response.status}.`);
      const html = await response.text();
      const title = textTitle(html) || source.name;
      const normalizedOfficialUrl = normalizeOfficialUrl(source.url);
      if (!normalizedOfficialUrl) throw new Error('La URL de la fuente no es válida.');
      const result = await createIngestedDraft({
        opportunity: {
          entity: source.name,
          entityShort: source.name.slice(0, 14),
          title,
          type: 'Empleo público',
          region: 'Lima',
          modality: 'Presencial',
          level: 'No especificado',
          careers: [],
          vacancies: 1,
          closingDate: '',
          officialUrl: source.url,
          summary: htmlMetadata(html, 'description') || 'Pendiente de revisión editorial.',
          beforeApplying: 'Revisá la fuente oficial antes de postular.',
          requirements: [],
          status: 'draft', verifiedAt: '', verifiedBy: '', publishedAt: '', isDemo: false, featured: false, color: '#245be8',
        },
        provenance: { sourceKind: 'gob-pe', sourceId: source.id, sourceUrl: source.url, ingestionRunId: run.id, capturedAt: new Date().toISOString(), originalOfficialUrl: source.url, normalizedOfficialUrl },
      });
      if (result.created) { imported++; await completeIngestionRun({ id: run.id, status: 'completed', importedCount: 1, invalidCount: 0, duplicateCount: 0 }); }
      else { duplicates++; await completeIngestionRun({ id: run.id, status: 'completed', importedCount: 0, invalidCount: 0, duplicateCount: 1 }); }
    } catch (error) {
      invalid++;
      const message = error instanceof Error ? error.message : 'No se pudo procesar la fuente.';
      errors.push(`${source.name}: ${message}`);
      await completeIngestionRun({ id: run.id, status: 'failed', importedCount: 0, invalidCount: 1, duplicateCount: 0, error: message });
    }
  }
  return { imported, invalid, duplicates, errors };
}
