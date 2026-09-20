import type { Opportunity, OpportunityType } from '../types';

export type IngestionSourceKind = 'excel' | 'gob-pe';

export interface IngestionProvenanceInput {
  sourceKind: IngestionSourceKind;
  sourceId?: string;
  sourceUrl?: string;
  ingestionRunId?: string;
  capturedAt?: string;
}

export interface MappedIngestionRow {
  rowNumber: number;
  opportunity: Omit<Opportunity, 'id' | 'slug'>;
  provenance: IngestionProvenanceInput & {
    originalOfficialUrl: string;
    normalizedOfficialUrl: string;
  };
}

export type IngestionRowResult =
  | { ok: true; rowNumber: number; opportunity: MappedIngestionRow['opportunity']; provenance: MappedIngestionRow['provenance'] }
  | { ok: false; rowNumber: number; errors: string[] };

export interface IngestionRowOptions extends IngestionProvenanceInput {
  rowNumber: number;
}

const TRACKING_QUERY_PARAMETER = /^(utm_[^=]*|fbclid|gclid|mc_[^=]*)$/i;
const opportunityTypes = new Set<OpportunityType>(['Empleo público', 'Prácticas', 'Empleo privado', 'Becas y programas']);
const modalities = new Set<Opportunity['modality']>(['Presencial', 'Híbrido', 'Remoto']);

function textValue(row: Record<string, unknown>, ...names: string[]): string {
  for (const name of names) {
    const value = row[name];
    if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  }
  return '';
}

function parseVacancies(value: string): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parseList(value: string): string[] {
  return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
}

/**
 * Creates a stable comparison key while retaining the original URL separately
 * for editorial traceability. Only known tracking parameters are discarded.
 */
export function normalizeOfficialUrl(value: string): string | undefined {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;

    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';

    const query = [...url.searchParams.entries()]
      .filter(([key]) => !TRACKING_QUERY_PARAMETER.test(key))
      .sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue));
    url.search = '';
    for (const [key, queryValue] of query) url.searchParams.append(key, queryValue);
    return url.toString();
  } catch {
    return undefined;
  }
}

export function mapIngestionRow(row: Record<string, unknown>, options: IngestionRowOptions): IngestionRowResult {
  const entity = textValue(row, 'Entidad', 'entidad');
  const title = textValue(row, 'Título', 'Titulo', 'título', 'titulo');
  const originalOfficialUrl = textValue(row, 'URL oficial', 'Url oficial', 'url oficial', 'officialUrl');
  const normalizedOfficialUrl = normalizeOfficialUrl(originalOfficialUrl);
  const errors: string[] = [];

  if (!entity) errors.push('Entidad es obligatoria.');
  if (!title) errors.push('Título es obligatorio.');
  if (!normalizedOfficialUrl) errors.push('URL oficial no es válida.');
  if (errors.length > 0) return { ok: false, rowNumber: options.rowNumber, errors };

  const typeValue = textValue(row, 'Tipo', 'tipo') as OpportunityType;
  const modalityValue = textValue(row, 'Modalidad', 'modalidad') as Opportunity['modality'];
  const salary = textValue(row, 'Remuneración', 'Remuneracion', 'remuneración', 'remuneracion', 'Salario', 'salario');

  return {
    ok: true,
    rowNumber: options.rowNumber,
    opportunity: {
      entity,
      entityShort: textValue(row, 'Nombre corto', 'nombre corto', 'Siglas', 'siglas'),
      title,
      type: opportunityTypes.has(typeValue) ? typeValue : 'Empleo público',
      region: textValue(row, 'Región', 'Region', 'región', 'region') || 'Lima',
      modality: modalities.has(modalityValue) ? modalityValue : 'Presencial',
      level: textValue(row, 'Nivel', 'nivel') || 'No especificado',
      careers: parseList(textValue(row, 'Carreras', 'carreras', 'Perfiles', 'perfiles')),
      vacancies: parseVacancies(textValue(row, 'Vacantes', 'vacantes')),
      closingDate: textValue(row, 'Fecha de cierre', 'fecha de cierre', 'Cierre', 'cierre'),
      officialUrl: originalOfficialUrl,
      summary: textValue(row, 'Resumen', 'resumen') || 'Pendiente de revisión editorial.',
      beforeApplying: textValue(row, 'Antes de postular', 'antes de postular') || 'Revisá la fuente oficial antes de postular.',
      requirements: parseList(textValue(row, 'Requisitos', 'requisitos')),
      ...(salary ? { salary } : {}),
      status: 'draft',
      verifiedAt: '',
      verifiedBy: '',
      publishedAt: '',
      isDemo: false,
      featured: false,
      color: '#245be8',
    },
    provenance: {
      sourceKind: options.sourceKind,
      ...(options.sourceId ? { sourceId: options.sourceId } : {}),
      ...(options.sourceUrl ? { sourceUrl: options.sourceUrl } : {}),
      ...(options.ingestionRunId ? { ingestionRunId: options.ingestionRunId } : {}),
      ...(options.capturedAt ? { capturedAt: options.capturedAt } : {}),
      originalOfficialUrl,
      normalizedOfficialUrl: normalizedOfficialUrl!,
    },
  };
}

export interface DuplicateRow {
  rowNumber: number;
  normalizedOfficialUrl: string;
  reason: 'existing' | 'batch';
}

export function deduplicateMappedRows(rows: Array<Extract<IngestionRowResult, { ok: true }>>, existingNormalizedUrls: Iterable<string> = []) {
  const seen = new Set([...existingNormalizedUrls].map((url) => normalizeOfficialUrl(url) ?? url));
  const accepted: Array<Extract<IngestionRowResult, { ok: true }>> = [];
  const duplicates: DuplicateRow[] = [];

  for (const row of rows) {
    const normalizedOfficialUrl = row.provenance.normalizedOfficialUrl;
    if (seen.has(normalizedOfficialUrl)) {
      duplicates.push({
        rowNumber: row.rowNumber,
        normalizedOfficialUrl,
        reason: accepted.some((item) => item.provenance.normalizedOfficialUrl === normalizedOfficialUrl) ? 'batch' : 'existing',
      });
      continue;
    }
    seen.add(normalizedOfficialUrl);
    accepted.push(row);
  }
  return { accepted, duplicates };
}
