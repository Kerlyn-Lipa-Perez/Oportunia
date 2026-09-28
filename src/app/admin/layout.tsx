import type { ReactNode } from 'react';
import { isEditorialAccess, requireEditorial } from '@/lib/auth';
import AdminLogin from './login';
import AdminSidebar from './sidebar';
import './admin.css';
import './dialog.css';
import './team.css';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'Panel editorial | Oportunia', robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const access = await requireEditorial();
  if (!isEditorialAccess(access)) return <AdminLogin access={access.kind} />;
  const editor = access.user.email || access.user.id;
  return (
    <div className="editor-app admin-shell">
      <AdminSidebar access={access.kind} editor={editor} />
      <main className="admin-content">{children}</main>
    </div>
  );
}
