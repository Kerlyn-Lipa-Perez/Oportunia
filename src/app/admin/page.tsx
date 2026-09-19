import { authConfigured, getEditor } from '@/lib/auth';
import { getAllOpportunities } from '@/lib/repository';
import AdminPanel from './panel';
import './admin.css';
import './dialog.css';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'Panel editorial | Oportunia', robots: { index: false, follow: false } };
export default async function AdminPage() {
  const editor = await getEditor();
  return <AdminPanel configured={authConfigured()} editor={editor} initial={editor ? await getAllOpportunities() : []} />;
}
