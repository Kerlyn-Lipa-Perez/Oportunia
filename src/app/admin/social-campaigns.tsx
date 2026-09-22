'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, BarChart3, Check, ExternalLink, FileVideo, Pencil, RefreshCw, Send, XCircle } from 'lucide-react';
import { getDeadline } from '@/lib/opportunities';
import type { SocialAnalyticsReadModel } from '@/lib/social-analytics';
import type { Opportunity, SocialCampaign, SocialCampaignStatus } from '@/lib/types';

type CampaignCopy = Pick<SocialCampaign, 'hook' | 'script' | 'coverText' | 'caption'>;
type PublicationInput = { publishedUrl: string; failureReason: string };

const statusLabels: Record<SocialCampaignStatus, string> = {
  draft: 'Borrador',
  approved: 'Aprobada',
  queued: 'En cola',
  published: 'Publicada',
  failed: 'Fallida',
};

async function responseJson(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { return null; }
}

function errorMessage(value: unknown, fallback: string): string {
  return value && typeof value === 'object' && 'error' in value && typeof value.error === 'string'
    ? value.error
    : fallback;
}

function formatDuration(value: number | null): string {
  if (value === null) return 'No disponible';
  if (value < 1_000) return `${value} ms`;
  return `${(value / 1_000).toLocaleString('es-PE', { maximumFractionDigits: 1 })} s`;
}

export default function SocialCampaignsPanel({ opportunities }: { opportunities: Opportunity[] }) {
  const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);
  const [analytics, setAnalytics] = useState<SocialAnalyticsReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedOpportunityId, setSelectedOpportunityId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [copy, setCopy] = useState<CampaignCopy | null>(null);
  const [publication, setPublication] = useState<Record<string, PublicationInput>>({});

  const opportunitiesById = useMemo(
    () => new Map(opportunities.map((opportunity) => [opportunity.id, opportunity])),
    [opportunities],
  );
  const eligibleOpportunities = useMemo(() => opportunities.filter((opportunity) => (
    opportunity.status === 'published'
    && !opportunity.isDemo
    && !!opportunity.verifiedAt
    && !!opportunity.verifiedBy.trim()
    && !getDeadline(opportunity.closingDate).closed
  )), [opportunities]);
  const analyticsByCode = useMemo(
    () => new Map((analytics?.campaigns ?? []).map((row) => [row.utmContent, row])),
    [analytics],
  );

  async function load() {
    setLoading(true); setError('');
    try {
      const [campaignResponse, analyticsResponse] = await Promise.all([
        fetch('/api/admin/social-campaigns'),
        fetch('/api/admin/social-campaigns/analytics'),
      ]);
      const [campaignResult, analyticsResult] = await Promise.all([
        responseJson(campaignResponse),
        responseJson(analyticsResponse),
      ]);
      if (!campaignResponse.ok) throw new Error(errorMessage(campaignResult, 'No se pudo cargar la cola.'));
      if (!analyticsResponse.ok) throw new Error(errorMessage(analyticsResult, 'No se pudo cargar la analítica.'));
      setCampaigns(Array.isArray(campaignResult) ? campaignResult as SocialCampaign[] : []);
      if (!analyticsResult || typeof analyticsResult !== 'object' || !('campaigns' in analyticsResult)) {
        throw new Error('La respuesta de analítica no es válida.');
      }
      setAnalytics(analyticsResult as SocialAnalyticsReadModel);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar Contenido TikTok.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOpportunityId) return;
    setBusyId('create'); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/social-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: selectedOpportunityId }),
      });
      const result = await responseJson(response);
      if (!response.ok) throw new Error(errorMessage(result, 'No se pudo generar el borrador.'));
      const campaign = result as SocialCampaign;
      setCampaigns((current) => [campaign, ...current]);
      setSelectedOpportunityId('');
      setMessage(`Borrador ${campaign.code} generado. Revísalo antes de aprobar.`);
      setEditingId(campaign.id);
      setCopy({ hook: campaign.hook, script: campaign.script, coverText: campaign.coverText, caption: campaign.caption });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo generar el borrador.');
    } finally { setBusyId(''); }
  }

  async function patchCampaign(id: string, changes: Record<string, string>) {
    setBusyId(id); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/social-campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...changes }),
      });
      const result = await responseJson(response);
      if (!response.ok) throw new Error(errorMessage(result, 'No se pudo actualizar la campaña.'));
      const updated = result as SocialCampaign;
      setCampaigns((current) => current.map((campaign) => campaign.id === id ? updated : campaign));
      setMessage(`${updated.code}: ${statusLabels[updated.status].toLowerCase()}.`);
      if (changes.hook !== undefined) { setEditingId(''); setCopy(null); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la campaña.');
    } finally { setBusyId(''); }
  }

  async function saveCopy(event: FormEvent<HTMLFormElement>, campaign: SocialCampaign) {
    event.preventDefault();
    if (!copy) return;
    await patchCampaign(campaign.id, copy);
  }

  function publicationInput(id: string): PublicationInput {
    return publication[id] || { publishedUrl: '', failureReason: '' };
  }

  function editPublication(id: string, key: keyof PublicationInput, value: string) {
    setPublication((current) => ({ ...current, [id]: { ...publicationInput(id), [key]: value } }));
  }

  return <section className="editor-social" aria-labelledby="social-campaigns-title">
    <div className="editor-social-heading">
      <div><p className="editor-eyebrow">CONTENIDO TIKTOK</p><h2 id="social-campaigns-title">Cola editorial y atribución</h2><p>Prepara el contenido, apruébalo y registra manualmente el resultado. Oportunia no publica en TikTok.</p></div>
      <button className="editor-secondary" type="button" onClick={() => void load()} disabled={loading || !!busyId}><RefreshCw size={16} /> Actualizar</button>
    </div>

    <form className="editor-social-create" onSubmit={createDraft}>
      <label>Oportunidad publicada y revisada<select aria-label="Oportunidad para contenido TikTok" value={selectedOpportunityId} onChange={(event) => setSelectedOpportunityId(event.target.value)} required><option value="">Seleccionar convocatoria…</option>{eligibleOpportunities.map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{opportunity.entity} · {opportunity.title}</option>)}</select></label>
      <button className="editor-primary" disabled={busyId === 'create' || eligibleOpportunities.length === 0}><FileVideo size={17} /> {busyId === 'create' ? 'Generando…' : 'Generar borrador'}</button>
    </form>
    {eligibleOpportunities.length === 0 && <p className="editor-social-hint">No hay oportunidades publicadas, verificadas y vigentes disponibles para un nuevo borrador.</p>}
    {error && <p className="editor-error" role="alert">{error}</p>}
    {message && <p className="editor-success" role="status">{message}</p>}

    {analytics && <div className="editor-analytics-readiness" aria-label="Readiness de analítica y monetización">
      <div><span>Días observados</span><strong>{analytics.readiness.measuredDays}</strong><small>Objetivo operativo: 14</small></div>
      <div><span>Estado de analítica</span><strong>{analytics.readiness.analyticsStatus === 'anomaly' ? 'Revisar alertas' : analytics.readiness.analyticsStatus === 'healthy' ? 'Sin anomalías' : 'Datos insuficientes'}</strong><small>Las alertas informan. No bloquea publicaciones automáticamente.</small></div>
      <div><span>Guías · Legal · SEO</span><strong>Evidencia manual pendiente</strong><small>No se infiere desde eventos ni se marca listo silenciosamente.</small></div>
      <div><span>RPM e ingresos</span><strong>Pendientes</strong><small>Requiere vincular GA4 ↔ AdSense; no hay valores estimados.</small></div>
    </div>}

    {analytics && analytics.readiness.alerts.length > 0 && <div className="editor-analytics-alerts" role="alert"><strong><AlertTriangle size={16} /> Alertas de tráfico</strong><ul>{analytics.readiness.alerts.map((alert) => <li key={alert.code}>{alert.message}</li>)}</ul><small>Revisá la adquisición antes de tomar decisiones. Estas alertas no desactivan anuncios ni publicaciones.</small></div>}

    {loading ? <div className="editor-social-state" role="status"><RefreshCw size={21} /> Cargando cola y analítica…</div> : campaigns.length === 0 ? <div className="editor-social-state"><FileVideo size={25} /><strong>No hay campañas todavía.</strong><span>Elige una oportunidad revisada para generar la primera ficha.</span></div> : <div className="editor-campaign-list">
      {campaigns.map((campaign) => {
        const opportunity = opportunitiesById.get(campaign.opportunityId);
        const metrics = analyticsByCode.get(campaign.code);
        const fields = publicationInput(campaign.id);
        const isBusy = busyId === campaign.id;
        const isEditing = editingId === campaign.id && copy;
        return <article className="editor-campaign" key={campaign.id}>
          <header className="editor-campaign-head"><div><code>{campaign.code}</code><span className={`editor-campaign-status is-${campaign.status}`}>{statusLabels[campaign.status]}</span></div><div><strong>{opportunity?.title || 'Oportunidad no disponible'}</strong><span>{opportunity?.entity || campaign.opportunityId}</span></div>{campaign.status === 'draft' && <button className="editor-secondary" type="button" onClick={() => { setEditingId(campaign.id); setCopy({ hook: campaign.hook, script: campaign.script, coverText: campaign.coverText, caption: campaign.caption }); }}><Pencil size={15} /> Editar ficha</button>}</header>

          <div className="editor-campaign-analytics" aria-label={`Analítica de ${campaign.code}`}><span><BarChart3 size={15} /> Sesiones</span><div><small>Sesiones</small><strong>{metrics?.sessions ?? '—'}</strong></div><div><small>Rebotes</small><strong>{metrics?.bounces ?? '—'}</strong></div><div><small>Tiempo medio en ficha</small><strong>{formatDuration(metrics?.averageDetailEngagementMs ?? null)}</strong></div><div><small>Fuente oficial</small><strong>{metrics?.officialClicks ?? '—'}</strong></div><div><small>Recurrentes</small><strong>{metrics?.returningVisitors ?? 'No disponible'}</strong></div>{metrics?.anomaly.status === 'anomaly' && <div className="editor-campaign-alert"><AlertTriangle size={15} /><span>{metrics.anomaly.alerts.map((alert) => alert.message).join(' ')}</span></div>}</div>

          {isEditing && <form className="editor-campaign-form" onSubmit={(event) => void saveCopy(event, campaign)}><label>Hook<textarea rows={2} maxLength={240} value={copy.hook} onChange={(event) => setCopy({ ...copy, hook: event.target.value })} required /></label><label>Texto de portada<input maxLength={160} value={copy.coverText} onChange={(event) => setCopy({ ...copy, coverText: event.target.value })} required /></label><label className="editor-span">Guion<textarea rows={6} maxLength={8000} value={copy.script} onChange={(event) => setCopy({ ...copy, script: event.target.value })} required /></label><label className="editor-span">Caption<textarea rows={4} maxLength={2200} value={copy.caption} onChange={(event) => setCopy({ ...copy, caption: event.target.value })} required /></label><div className="editor-campaign-form-actions"><button className="editor-secondary" type="button" onClick={() => { setEditingId(''); setCopy(null); }}>Cancelar</button><button className="editor-primary" disabled={isBusy}>Guardar ficha</button></div></form>}

          <div className="editor-campaign-workflow">
            {campaign.status === 'draft' && <button className="editor-primary" type="button" disabled={isBusy || !!isEditing} onClick={() => void patchCampaign(campaign.id, { status: 'approved' })}><Check size={16} /> Aprobar contenido</button>}
            {campaign.status === 'approved' && <button className="editor-primary" type="button" disabled={isBusy} onClick={() => void patchCampaign(campaign.id, { status: 'queued' })}><Send size={16} /> Pasar a cola manual</button>}
            {campaign.status === 'queued' && <div className="editor-publication-box"><p>Publica manualmente en TikTok. Al confirmar, el servidor registra la fecha y hora.</p><label>URL pública de TikTok<input type="url" placeholder="https://www.tiktok.com/@cuenta/video/…" value={fields.publishedUrl} onChange={(event) => editPublication(campaign.id, 'publishedUrl', event.target.value)} /></label><button className="editor-primary" type="button" disabled={isBusy || !fields.publishedUrl.trim()} onClick={() => void patchCampaign(campaign.id, { status: 'published', publishedUrl: fields.publishedUrl })}><Check size={16} /> Marcar publicada</button><label>Motivo si falló<input value={fields.failureReason} onChange={(event) => editPublication(campaign.id, 'failureReason', event.target.value)} placeholder="Describe qué impidió publicarla" /></label><button className="editor-secondary editor-danger" type="button" disabled={isBusy || !fields.failureReason.trim()} onClick={() => void patchCampaign(campaign.id, { status: 'failed', failureReason: fields.failureReason })}><XCircle size={16} /> Marcar fallida</button></div>}
            {campaign.status === 'published' && <div className="editor-campaign-result"><span>Publicada {campaign.publishedAt ? new Date(campaign.publishedAt).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : 'sin fecha registrada'}</span>{campaign.publishedUrl && <a href={campaign.publishedUrl} target="_blank" rel="noopener noreferrer">Abrir video <ExternalLink size={14} /></a>}</div>}
            {campaign.status === 'failed' && <div className="editor-campaign-result is-failed"><span>Publicación fallida</span><p>{campaign.failureReason}</p></div>}
          </div>
        </article>;
      })}
    </div>}
  </section>;
}
