import { isEditorialAccess, requireEditorial } from '@/lib/auth';
import { getAllOpportunities } from '@/lib/repository';
import AdminPanel from './panel';
import './admin.css';
import './dialog.css';
import './team.css';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'Panel editorial | Oportunia', robots: { index: false, follow: false } };
export default async function AdminPage() {
  const access = await requireEditorial();
  const editor = isEditorialAccess(access) ? access.user.email || access.user.id : null;
  return <AdminPanel access={access.kind} editor={editor} initial={editor ? await getAllOpportunities() : []} />;
}
