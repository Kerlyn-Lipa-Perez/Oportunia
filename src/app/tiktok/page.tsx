import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarDays, ExternalLink, Play, ShieldCheck } from 'lucide-react';
import { AttributionTracker } from '@/components/attribution-tracker';
import { Footer, Header } from '@/components/portal';
import { getDeadline } from '@/lib/opportunities';
import { getAllOpportunities, listSocialCampaigns } from '@/lib/repository';
import { buildTikTokDetailHref, selectPublicTikTokCampaigns } from './model';
import './tiktok.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Convocatorias de TikTok',
  description: 'Revisa las convocatorias vigentes que compartimos en TikTok y confirma cada dato en su fuente oficial.',
  alternates: { canonical: '/tiktok' },
  openGraph: {
    title: 'Convocatorias de TikTok | Oportunia',
    description: 'Del video a la ficha completa, con fechas claras y fuente oficial.',
    url: '/tiktok',
    type: 'website',
  },
};

export default async function TikTokPage() {
  const [campaigns, opportunities] = await Promise.all([
    listSocialCampaigns('published'),
    getAllOpportunities(),
  ]);
  const entries = selectPublicTikTokCampaigns(campaigns, opportunities);
  const opportunityIdByContent = Object.fromEntries(
    entries.map(({ campaign, opportunity }) => [campaign.code, opportunity.id]),
  );

  return <>
    <Header />
    <AttributionTracker name="landing_view" opportunityIdByContent={opportunityIdByContent} />
    <main className="tiktok-page">
      <section className="tiktok-hero container">
        <div className="tiktok-kicker"><Play size={14} fill="currentColor" /> DESDE TIKTOK, CON EL CONTEXTO COMPLETO</div>
        <h1>La convocatoria del video,<br /><span>lista para revisar.</span></h1>
        <p>Identifica el código que viste, confirma el cierre y entra a la ficha antes de visitar la fuente oficial.</p>
        <div className="tiktok-trust"><ShieldCheck size={18} /><span>Sólo mostramos oportunidades vigentes y revisadas por el equipo editorial.</span></div>
      </section>

      <section className="tiktok-feed container" aria-labelledby="tiktok-list-title">
        <div className="tiktok-feed-heading">
          <div><p className="eyebrow">VIDEOS PUBLICADOS</p><h2 id="tiktok-list-title">Encuentra el código de tu video</h2></div>
          {entries.length > 0 && <span className="tiktok-count">{entries.length} {entries.length === 1 ? 'convocatoria' : 'convocatorias'}</span>}
        </div>

        {entries.length === 0 ? <div className="tiktok-empty">
          <span className="tiktok-empty-icon"><Play size={25} /></span>
          <h2>Todavía no hay videos publicados.</h2>
          <p>Cuando una convocatoria revisada tenga un video activo, vas a encontrarla acá. Mientras tanto, puedes explorar el catálogo completo.</p>
          <Link className="button button-primary" href="/#oportunidades">Explorar oportunidades <ArrowRight size={17} /></Link>
        </div> : <div className="tiktok-list">
          {entries.map(({ campaign, opportunity }) => {
            const deadline = getDeadline(opportunity.closingDate);
            return <article className="tiktok-card" key={campaign.id}>
              <div className="tiktok-video-code"><span>CÓDIGO DEL VIDEO</span><code>{campaign.code}</code></div>
              <div className="tiktok-card-body">
                <div className="tiktok-entity"><span className="entity-mark" style={{ '--entity-color': opportunity.color } as React.CSSProperties}>{opportunity.entityShort || opportunity.entity.slice(0, 3).toUpperCase()}</span><div><strong>{opportunity.entity}</strong><span><ShieldCheck size={13} /> Fuente revisada</span></div></div>
                <h2>{opportunity.title}</h2>
                <p>{opportunity.summary}</p>
                <div className={`tiktok-deadline ${deadline.urgent ? 'is-urgent' : ''}`}><CalendarDays size={17} /><strong>{deadline.label}</strong><span>· {opportunity.region}</span></div>
              </div>
              <div className="tiktok-card-actions">
                <Link className="button button-primary" href={buildTikTokDetailHref(opportunity.slug, campaign.code)}>Revisar ficha completa <ArrowRight size={17} /></Link>
                {campaign.publishedUrl && <a className="button button-secondary" href={campaign.publishedUrl} target="_blank" rel="noopener noreferrer">Ver video <ExternalLink size={16} /></a>}
              </div>
            </article>;
          })}
        </div>}
      </section>
    </main>
    <Footer />
  </>;
}
