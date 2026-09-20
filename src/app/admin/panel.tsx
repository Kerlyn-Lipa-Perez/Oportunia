'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { createAuthClient } from '@neondatabase/auth/next';
import { ArrowLeft, Plus, LogOut, Pencil, X, Eye, ShieldCheck, Search, FileText, Download, Upload, Play, History, AlertTriangle } from 'lucide-react';
import type { Opportunity } from '@/lib/types';
import { getDeadline, modalities, opportunityTypes, levels } from '@/lib/opportunities';

type Draft = Omit<Opportunity, 'id'> & { id?: string; verified?: boolean };
const empty = (): Draft => ({ slug: '', entity: '', entityShort: '', title: '', type: 'Empleo público', region: 'Lima', modality: 'Presencial', level: 'Profesional', careers: [], vacancies: 1, closingDate: '', officialUrl: '', summary: '', beforeApplying: '', requirements: [], salary: '', status: 'draft', verifiedAt: '', verifiedBy: '', publishedAt: '', isDemo: false, featured: false, color: '#245be8', verified: false });
const statusNames = { draft: 'Borrador', published: 'Publicada', closed: 'Cerrada', scheduled: 'Programada' };
type RowIssue = { rowNumber: number; errors?: string[]; reason?: string; normalizedOfficialUrl?: string };
type ImportPreview = { valid: number; invalid: number; duplicates: number; issues: RowIssue[] };
type IngestionRun = { id: string; trigger: string; status: string; startedAt: string; completedAt?: string; importedCount?: number; invalidCount?: number; duplicateCount?: number; error?: string };
const authClient = createAuthClient();

export default function AdminPanel({ access, editor, initial }: { access: 'admin' | 'unauthenticated' | 'forbidden'; editor: string | null; initial: Opportunity[] }) {
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [history, setHistory] = useState<IngestionRun[]>([]);
  const [ingestionBusy, setIngestionBusy] = useState(false);
  const [ingestionError, setIngestionError] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isEditing = draft !== null;
  useEffect(() => {
    if (isEditing) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [isEditing]);
  const edit = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => current ? { ...current, [key]: value } : null);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data = new FormData(event.currentTarget);
    try { const { error: authError } = await authClient.signIn.email({ email: String(data.get('email') || ''), password: String(data.get('password') || '') }); if (authError) throw new Error(authError.message || 'No se pudo iniciar sesión.'); window.location.reload(); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.'); } finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!draft) return; setBusy(true); setError('');
    try { const response = await fetch('/api/admin/opportunities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setItems((all) => [result, ...all.filter((item) => item.id !== result.id)]); setDraft(null); setSuccess('Convocatoria guardada correctamente.'); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); } finally { setBusy(false); }
  }
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
  const visible = items.filter((item) => (filter === 'all' || (filter === 'urgent' ? getDeadline(item.closingDate).urgent && item.status === 'published' : filter === 'closed' ? item.status === 'closed' || getDeadline(item.closingDate).closed : item.status === filter)) && `${item.title} ${item.entity}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="editor-app">
    <header className="editor-header"><Link className="editor-brand" href="/">oportunia<span>EDITORIAL</span></Link><Link href="/" className="editor-back"><ArrowLeft size={16} /> Ver portal</Link>{access !== 'unauthenticated' && <button className="editor-secondary" onClick={async () => { const { error: authError } = await authClient.signOut(); if (authError) setError(authError.message || 'No se pudo cerrar sesión.'); else window.location.reload(); }}><LogOut size={16} /> Salir</button>}</header>
    {!editor ? <main className="editor-login"><div className="editor-icon"><ShieldCheck size={28} /></div><h1>Tu espacio editorial</h1><p>Información clara empieza con una buena revisión.</p>{access === 'forbidden' ? <div className="editor-notice"><h2>Cuenta sin permiso editorial</h2><p>Tu sesión es válida, pero esta cuenta no tiene el rol de administrador. Pedí a un administrador que habilite tu perfil de aplicación.</p></div> : <form onSubmit={login}><label>Correo editorial<input name="email" type="email" required autoComplete="username" placeholder="editor@oportunia.pe" /></label><label>Contraseña<input name="password" type="password" required autoComplete="current-password" /></label>{error && <p role="alert" className="editor-error">{error}</p>}<button className="editor-primary" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar al CMS'}</button></form>}</main> : <main className="editor-main">
      <div className="editor-title"><div><p className="editor-eyebrow">PANEL EDITORIAL</p><h1>Convocatorias</h1><p>Publica con claridad. Revisa a tiempo.</p></div><button className="editor-primary" onClick={() => { setDraft(empty()); setError(''); setPreview(false); setSuccess(''); }}><Plus size={18} /> Nueva convocatoria</button></div>
      <div className="editor-stats"><div><span>Total de fichas</span><strong>{items.length}</strong></div><div><span>Publicadas y vigentes</span><strong>{items.filter((i) => i.status === 'published' && !getDeadline(i.closingDate).closed).length}</strong></div><div><span>Cierran pronto</span><strong>{items.filter((i) => i.status === 'published' && getDeadline(i.closingDate).urgent).length}</strong></div><div><span>Borradores</span><strong>{items.filter((i) => i.status === 'draft').length}</strong></div></div>
      <section className="editor-ingestion" aria-labelledby="ingestion-title"><div className="editor-ingestion-heading"><div><p className="editor-eyebrow">INGESTA CONTROLADA</p><h2 id="ingestion-title">Carga y fuentes oficiales</h2><p>Todo ingreso queda como borrador para revisión editorial.</p></div><div className="editor-ingestion-actions"><a className="editor-secondary" href="/api/admin/ingestion/template"><Download size={16} /> Plantilla Excel</a><button className="editor-secondary" type="button" onClick={runSources} disabled={ingestionBusy}><Play size={16} /> Ejecutar fuentes</button><button className="editor-secondary" type="button" onClick={loadHistory} disabled={ingestionBusy}><History size={16} /> Actualizar historial</button></div></div><form className="editor-import-form" onSubmit={previewImport}><label>Archivo .xlsx<input name="file" type="file" accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx" required /></label><button className="editor-primary" disabled={ingestionBusy}><Upload size={16} /> {ingestionBusy ? 'Procesando…' : 'Validar archivo'}</button></form>{ingestionError && <p className="editor-error" role="alert">{ingestionError}</p>}{importPreview && <div className="editor-import-preview" aria-live="polite"><div><strong>Vista previa</strong><span>{importPreview.valid} válidas · {importPreview.invalid} inválidas · {importPreview.duplicates} duplicadas</span></div>{importPreview.issues.length > 0 && <ul>{importPreview.issues.slice(0, 8).map((issue) => <li key={`${issue.rowNumber}-${issue.reason || issue.errors?.join('-')}`}><AlertTriangle size={15} /> Fila {issue.rowNumber}: {issue.errors?.join(' ') || issue.reason || 'duplicada'}{issue.normalizedOfficialUrl ? ` (${issue.normalizedOfficialUrl})` : ''}</li>)}</ul>}<button className="editor-primary" type="button" onClick={confirmImport} disabled={ingestionBusy || importPreview.valid === 0}>Confirmar e importar borradores</button></div>}{history.length > 0 && <div className="editor-ingestion-history"><h3>Últimas ejecuciones</h3>{history.slice(0, 6).map((run) => <article key={run.id}><div><strong>{run.trigger === 'excel' ? 'Archivo Excel' : 'Fuentes oficiales'}</strong><span>{new Date(run.startedAt).toLocaleString('es-PE')}</span></div><p>{run.status} · {run.importedCount || 0} importadas · {run.invalidCount || 0} inválidas · {run.duplicateCount || 0} duplicadas</p>{run.error && <small>{run.error}</small>}</article>)}</div>}</section>
      {success && <p role="status" className="editor-success">{success}</p>}
      <div className="editor-tools"><label className="editor-search"><Search size={18} /><input aria-label="Buscar fichas" placeholder="Buscar por entidad o puesto…" value={search} onChange={(e) => setSearch(e.target.value)} /></label><select aria-label="Filtrar por estado" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Todos los estados</option><option value="published">Publicadas</option><option value="urgent">Cierran pronto</option><option value="draft">Borradores</option><option value="scheduled">Programadas</option><option value="closed">Cerradas / vencidas</option></select></div>
      <div className="editor-list">{visible.length === 0 && <div className="editor-empty"><FileText /><h2>No encontramos fichas</h2><p>Prueba otro filtro o crea una convocatoria.</p></div>}{visible.map((item) => <article key={item.id} className="editor-row"><div><small>{item.entity} {item.isDemo && ' · DEMOSTRACIÓN'}</small><h2>{item.title}</h2><p>{item.region} · {item.type} · {item.vacancies} vacantes</p></div><div className="editor-row-status"><span>{getDeadline(item.closingDate).closed ? 'Vencida' : statusNames[item.status]}</span><small>{getDeadline(item.closingDate).label}</small>{item.verifiedAt && <small>Revisada: {new Date(item.verifiedAt).toLocaleDateString('es-PE')}</small>}</div><button className="editor-secondary" aria-label={`Editar ${item.title}`} onClick={() => { setDraft({ ...item, verified: false }); setPreview(false); setError(''); }}><Pencil size={16} /> Editar</button></article>)}</div>
      <p className="editor-footer">Sesión: {editor}. Las fichas vencidas se muestran cerradas automáticamente en el portal.</p>
    </main>}
    {draft && <dialog ref={dialogRef} className="editor-overlay" aria-labelledby="edit-title" onCancel={() => setDraft(null)}><section className="editor-dialog"><div className="editor-dialog-head"><div><p className="editor-eyebrow">INFORMACIÓN CONFIABLE</p><h2 id="edit-title">{draft.id ? 'Editar convocatoria' : 'Nueva convocatoria'}</h2></div><button className="editor-icon-button" aria-label="Cerrar formulario" onClick={() => setDraft(null)}><X /></button></div><div className="editor-tabs"><button type="button" className={!preview ? 'active' : ''} onClick={() => setPreview(false)}>Información</button><button type="button" className={preview ? 'active' : ''} onClick={() => setPreview(true)}><Eye size={16} /> Vista previa</button></div>
      {preview ? <div className="editor-preview"><span className="editor-eyebrow">VISTA PREVIA · {draft.type}</span><h2>{draft.title || 'Título de la convocatoria'}</h2><p>{draft.entity || 'Entidad'} · {draft.region} · {draft.modality}</p><div className="editor-notice">{draft.closingDate ? getDeadline(draft.closingDate).label : 'Agrega una fecha de cierre'} · {draft.vacancies} vacantes</div><p>{draft.summary || 'El resumen aparecerá aquí.'}</p><h3>Requisitos</h3><ul>{draft.requirements.map((line, index) => <li key={index}>{line}</li>)}</ul><h3>Antes de postular</h3><p>{draft.beforeApplying || 'Indica qué debe revisar la persona antes de postular.'}</p><p className="editor-source">Fuente: {draft.officialUrl || 'Pendiente'}</p><button className="editor-primary" onClick={() => setPreview(false)}>Volver a editar</button></div> : <form onSubmit={save} className="editor-form">
        <div className="editor-form-grid"><label>Entidad *<input required value={draft.entity} onChange={(e) => edit('entity', e.target.value)} placeholder="Ej. SUNAT" /></label><label>Nombre corto<input value={draft.entityShort} onChange={(e) => edit('entityShort', e.target.value)} placeholder="Siglas de la entidad" /></label><label className="editor-span">Título de la convocatoria *<input required value={draft.title} onChange={(e) => edit('title', e.target.value)} placeholder="Ej. Practicante de Administración" /></label><label>Tipo<select value={draft.type} onChange={(e) => edit('type', e.target.value as Opportunity['type'])}>{opportunityTypes.map((i) => <option key={i}>{i}</option>)}</select></label><label>Región<input value={draft.region} onChange={(e) => edit('region', e.target.value)} /></label><label>Modalidad<select value={draft.modality} onChange={(e) => edit('modality', e.target.value as Opportunity['modality'])}>{modalities.map((i) => <option key={i}>{i}</option>)}</select></label><label>Nivel<select value={draft.level} onChange={(e) => edit('level', e.target.value)}>{levels.map((i) => <option key={i}>{i}</option>)}</select></label><label className="editor-span">Carreras / perfiles (separados por comas)<input value={draft.careers.join(',')} onChange={(e) => edit('careers', e.target.value.split(','))} placeholder="Administración, Contabilidad" /></label><label>Vacantes<input type="number" min="1" value={draft.vacancies} onChange={(e) => edit('vacancies', Number(e.target.value))} /></label><label>Cierre (hora de Perú)<input type="date" value={draft.closingDate} onChange={(e) => edit('closingDate', e.target.value)} /></label><label>Remuneración / beneficio<input value={draft.salary || ''} onChange={(e) => edit('salary', e.target.value)} placeholder="Ej. S/ 1,130" /></label><label>URL oficial<input type="url" value={draft.officialUrl} onChange={(e) => edit('officialUrl', e.target.value)} placeholder="https://…" /></label><label className="editor-span">Resumen<textarea rows={3} value={draft.summary} onChange={(e) => edit('summary', e.target.value)} /></label><label className="editor-span">Requisitos (uno por línea)<textarea rows={4} value={draft.requirements.join('\n')} onChange={(e) => edit('requirements', e.target.value.split('\n'))} /></label><label className="editor-span">Antes de postular<textarea rows={3} value={draft.beforeApplying} onChange={(e) => edit('beforeApplying', e.target.value)} placeholder="¿Qué requisito o documento es decisivo?" /></label><label>Estado<select value={draft.status} onChange={(e) => edit('status', e.target.value as Opportunity['status'])}><option value="draft">Borrador / despublicada</option><option value="published">Publicada</option><option value="scheduled">Programada</option><option value="closed">Cerrada</option></select></label>{draft.status === 'scheduled' && <label>Publicar el (hora local)<input type="datetime-local" required value={draft.publishedAt ? new Date(new Date(draft.publishedAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} onChange={(e) => edit('publishedAt', e.target.value ? new Date(e.target.value).toISOString() : '')} /></label>}<label className="editor-check editor-span"><input type="checkbox" checked={draft.featured} onChange={(e) => edit('featured', e.target.checked)} /> Destacar en el portal</label>{(draft.status === 'published' || draft.status === 'scheduled' || draft.status === 'closed') && <label className="editor-check editor-span"><input type="checkbox" checked={draft.verified === true} onChange={(e) => edit('verified', e.target.checked)} /> Revisé la fuente oficial, las bases y la fecha de cierre. Mi correo quedará registrado como responsable.</label>}</div>
        {draft.isDemo && <p className="editor-notice">Esta ficha es de demostración. Sólo confirma la verificación si reemplazaste el contenido por una convocatoria real.</p>}{error && <p className="editor-error" role="alert">{error}</p>}<div className="editor-form-actions"><button type="button" className="editor-secondary" onClick={() => setDraft(null)}>Cancelar</button><button className="editor-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar convocatoria'}</button></div>
      </form>}
    </section></dialog>}
  </div>;
}
