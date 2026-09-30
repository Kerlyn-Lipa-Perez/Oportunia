import { isEditorialAccess, requireEditorial } from '@/lib/auth';
import { getAllOpportunities } from '@/lib/repository';
import SocialCampaignsPanel from '../social-campaigns';

export default async function CampanasPage() {
  const access = await requireEditorial();
  if (!isEditorialAccess(access)) return null;
  const items = await getAllOpportunities();

  return (
    <div className="editor-main">
      <div className="editor-title"><div><p className="editor-eyebrow">PANEL EDITORIAL</p><h1>Campañas TikTok</h1><p>Planea, aprueba y mide el contenido de la cuenta.</p></div></div>
      <SocialCampaignsPanel opportunities={items} />
    </div>
  );
}
