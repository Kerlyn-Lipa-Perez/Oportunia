import * as XLSX from 'xlsx';
import { mapIngestionRow, type IngestionRowOptions, type IngestionRowResult } from './rows';

export const OPPORTUNITY_TEMPLATE_HEADERS = [
  'Entidad',
  'Título',
  'URL oficial',
  'Nombre corto',
  'Tipo',
  'Región',
  'Modalidad',
  'Nivel',
  'Carreras',
  'Vacantes',
  'Fecha de cierre',
  'Remuneración',
  'Resumen',
  'Requisitos',
  'Antes de postular',
] as const;

export interface ParsedWorkbookRow {
  rowNumber: number;
  values: Record<string, unknown>;
}

export interface ParsedOpportunityWorkbook {
  headers: string[];
  rows: ParsedWorkbookRow[];
}

export function createOpportunityTemplate(): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet([Array.from(OPPORTUNITY_TEMPLATE_HEADERS)]);
  sheet['!cols'] = OPPORTUNITY_TEMPLATE_HEADERS.map((header) => ({ wch: Math.max(header.length + 4, 18) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Oportunidades');
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
}

export function parseOpportunityWorkbook(input: ArrayBuffer | Uint8Array): ParsedOpportunityWorkbook {
  const workbook = XLSX.read(input, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('El archivo no contiene hojas.');
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) throw new Error('No se pudo leer la primera hoja.');

  const values = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false });
  const headers = (values[0] ?? []).map((value) => String(value).trim());
  if (headers.length === 0 || headers.every((header) => !header)) throw new Error('La primera fila debe contener encabezados.');

  const rows = values.slice(1).flatMap((cells, index) => {
    if (!cells.some((cell) => String(cell ?? '').trim())) return [];
    const row: Record<string, unknown> = {};
    headers.forEach((header, cellIndex) => {
      if (header) row[header] = cells[cellIndex] ?? '';
    });
    return [{ rowNumber: index + 2, values: row }];
  });
  return { headers, rows };
}

export function parseAndMapOpportunityWorkbook(input: ArrayBuffer | Uint8Array, options: Omit<IngestionRowOptions, 'rowNumber'>): IngestionRowResult[] {
  return parseOpportunityWorkbook(input).rows.map((row) => mapIngestionRow(row.values, { ...options, rowNumber: row.rowNumber }));
}
