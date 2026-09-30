'use client';
import { useState, type FormEvent } from 'react';
import { Download, Upload, Play, History, AlertTriangle } from 'lucide-react';

type RowIssue = { rowNumber: number; errors?: string[]; reason?: string; normalizedOfficialUrl?: string };
type ImportPreview = { valid: number; invalid: number; duplicates: number; issues: RowIssue[] };
type IngestionRun = { id: string; trigger: string; status: string; startedAt: string; completedAt?: string; importedCount?: number; invalidCount?: number; duplicateCount?: number; error?: string };

export default function IngestionPanel() {
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [history, setHistory] = useState<IngestionRun[]>([]);
  const [ingestionBusy, setIngestionBusy] = useState(false);
  const [ingestionError, setIngestionError] = useState('');
  const [success, setSuccess] = useState('');
  async function loadHistory() {
    try {
      const response = await fetch('/api/admin/ingestion/history');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setHistory(Array.isArray(result.runs) ? result.runs : []);
    } catch (e) { setIngestionError(e instanceof Error ? e.message : 'No se pudo cargar el historial.'); }
  }
  async function previewImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get('file');
    if (!(file instanceof File) || !file.size) { setIngestionError('Selecciona un archivo .xlsx.'); return; }
    setIngestionBusy(true); setIngestionError(''); setImportPreview(null); setImportFile(null);
    try {
      const data = new FormData(); data.set('file', file);
      const response = await fetch('/api/admin/ingestion/imports/preview', { method: 'POST', body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setImportPreview(result); setImportFile(file);
    } catch (e) { setIngestionError(e instanceof Error ? e.message : 'No se pudo validar el archivo.'); } finally { setIngestionBusy(false); }
  }
  async function confirmImport() {
    if (!importPreview || !importFile) return;
    setIngestionBusy(true); setIngestionError('');
    try {
      const data = new FormData(); data.set('file', importFile);
      const response = await fetch('/api/admin/ingestion/imports/confirm', { method: 'POST', body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSuccess(`${result.imported || 0} borradores importados. ${result.invalid || 0} filas inválidas y ${result.duplicates || 0} duplicadas no se incorporaron.`);
      setImportPreview(null); setImportFile(null); await loadHistory();
    } catch (e) { setIngestionError(e instanceof Error ? e.message : 'No se pudo confirmar la importación.'); } finally { setIngestionBusy(false); }
  }
  async function runSources() {
    setIngestionBusy(true); setIngestionError('');
    try {
      const response = await fetch('/api/admin/ingestion/sources/run', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSuccess(`Fuentes ejecutadas: ${result.imported || 0} borradores creados; ${result.duplicates || 0} duplicados omitidos.`);
      await loadHistory();
    } catch (e) { setIngestionError(e instanceof Error ? e.message : 'No se pudieron ejecutar las fuentes aprobadas.'); } finally { setIngestionBusy(false); }
  }
  return (
    <div className="editor-main">
      <section className="editor-ingestion" aria-labelledby="ingestion-title"><div className="editor-ingestion-heading"><div><p className="editor-eyebrow">INGESTA CONTROLADA</p><h2 id="ingestion-title">Carga y fuentes oficiales</h2><p>Todo ingreso queda como borrador para revisión editorial.</p></div><div className="editor-ingestion-actions"><a className="editor-secondary" href="/api/admin/ingestion/template"><Download size={16} /> Plantilla Excel</a><button className="editor-secondary" type="button" onClick={runSources} disabled={ingestionBusy}><Play size={16} /> Ejecutar fuentes</button><button className="editor-secondary" type="button" onClick={loadHistory} disabled={ingestionBusy}><History size={16} /> Actualizar historial</button></div></div><form className="editor-import-form" onSubmit={previewImport}><label>Archivo .xlsx<input name="file" type="file" accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx" required /></label><button className="editor-primary" disabled={ingestionBusy}><Upload size={16} /> {ingestionBusy ? 'Procesando…' : 'Validar archivo'}</button></form>{ingestionError && <p className="editor-error" role="alert">{ingestionError}</p>}{importPreview && <div className="editor-import-preview" aria-live="polite"><div><strong>Vista previa</strong><span>{importPreview.valid} válidas · {importPreview.invalid} inválidas · {importPreview.duplicates} duplicadas</span></div>{importPreview.issues.length > 0 && <ul>{importPreview.issues.slice(0, 8).map((issue) => <li key={`${issue.rowNumber}-${issue.reason || issue.errors?.join('-')}`}><AlertTriangle size={15} /> Fila {issue.rowNumber}: {issue.errors?.join(' ') || issue.reason || 'duplicada'}{issue.normalizedOfficialUrl ? ` (${issue.normalizedOfficialUrl})` : ''}</li>)}</ul>}<button className="editor-primary" type="button" onClick={confirmImport} disabled={ingestionBusy || importPreview.valid === 0}>Confirmar e importar borradores</button></div>}{history.length > 0 && <div className="editor-ingestion-history"><h3>Últimas ejecuciones</h3>{history.slice(0, 6).map((run) => <article key={run.id}><div><strong>{run.trigger === 'excel' ? 'Archivo Excel' : 'Fuentes oficiales'}</strong><span>{new Date(run.startedAt).toLocaleString('es-PE')}</span></div><p>{run.status} · {run.importedCount || 0} importadas · {run.invalidCount || 0} inválidas · {run.duplicateCount || 0} duplicadas</p>{run.error && <small>{run.error}</small>}</article>)}</div>}</section>
      {success && <p role="status" className="editor-success">{success}</p>}
    </div>
  );
}
