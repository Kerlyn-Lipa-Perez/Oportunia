import Link from 'next/link';
import { isEditorialAccess, requireEditorial } from '@/lib/auth';
import { getAllOpportunities } from '@/lib/repository';
import { getDeadline } from '@/lib/opportunities';

export default async function AdminHomePage() {
  const access = await requireEditorial();
  if (!isEditorialAccess(access)) return null;
  const items = await getAllOpportunities();

  return (
    <div className="editor-main">
      <div className="editor-title"><div><p className="editor-eyebrow">PANEL EDITORIAL</p><h1>Resumen</h1><p>Estado general de las convocatorias publicadas.</p></div><Link className="editor-primary" href="/admin/convocatorias">Gestionar fichas</Link></div>
      <div className="editor-stats"><div><span>Total de fichas</span><strong>{items.length}</strong></div><div><span>Publicadas y vigentes</span><strong>{items.filter((i) => i.status === 'published' && !getDeadline(i.closingDate).closed).length}</strong></div><div><span>Cierran pronto</span><strong>{items.filter((i) => i.status === 'published' && getDeadline(i.closingDate).urgent).length}</strong></div><div><span>Borradores</span><strong>{items.filter((i) => i.status === 'draft').length}</strong></div></div>
      <section className="editor-quick">
        <h2>Accesos rápidos</h2>
        <div className="editor-quick-links">
          <Link href="/admin/convocatorias">Convocatorias</Link>
          <Link href="/admin/campanas">Campañas TikTok</Link>
          <Link href="/admin/ingesta">Ingesta</Link>
        </div>
      </section>
    </div>
  );
}
