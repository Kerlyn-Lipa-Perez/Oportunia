'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createAuthClient } from '@neondatabase/auth/next';
import { ArrowLeft, LogOut, Menu, X } from 'lucide-react';

const authClient = createAuthClient();

const sections: Record<string, string> = {
  '/admin': 'Resumen',
  '/admin/convocatorias': 'Convocatorias',
  '/admin/campanas': 'Campañas TikTok',
  '/admin/ingesta': 'Ingesta',
  '/admin/equipo': 'Equipo',
};

function isActivePath(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminSidebar({ access, editor }: { access: 'admin' | 'editor'; editor: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const section = sections[pathname] || (pathname.startsWith('/admin/equipo') ? 'Equipo' : 'Resumen');
  const current = (href: string) => (isActivePath(pathname, href) ? 'page' : undefined);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function signOut() {
    const { error: authError } = await authClient.signOut();
    if (authError) setSignOutError(authError.message || 'No se pudo cerrar sesión.');
    else window.location.reload();
  }

  return (
    <>
      <header className="admin-topbar">
        <button
          type="button"
          className="admin-menu-toggle"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        <p className="admin-breadcrumb"><span>Panel editorial</span> / {section}</p>
      </header>
      <aside className={`admin-sidebar${open ? ' is-open' : ''}`}>
        <div className="admin-sidebar-head">
          <Link className="editor-brand" href="/">oportunia<span>EDITORIAL</span></Link>
        </div>
        <nav className="admin-nav" aria-label="Secciones del panel">
          <ul>
            <li><Link href="/admin" aria-current={current('/admin')}>Resumen</Link></li>
            <li><Link href="/admin/convocatorias" aria-current={current('/admin/convocatorias')}>Convocatorias</Link></li>
            <li><Link href="/admin/campanas" aria-current={current('/admin/campanas')}>Campañas TikTok</Link></li>
            <li><Link href="/admin/ingesta" aria-current={current('/admin/ingesta')}>Ingesta</Link></li>
            {access === 'admin' && <li><Link href="/admin/equipo" aria-current={current('/admin/equipo')}>Equipo</Link></li>}
          </ul>
        </nav>
        <footer className="admin-sidebar-foot">
          <p className="admin-session"><span>Sesión activa</span>{editor}</p>
          <Link href="/" className="admin-portal-link"><ArrowLeft size={16} /> Ver portal</Link>
          <button type="button" className="editor-secondary admin-signout" onClick={signOut}>
            <LogOut size={16} /> Salir
          </button>
          {signOutError && <p role="alert" className="editor-error">{signOutError}</p>}
        </footer>
      </aside>
      {open && <button type="button" className="admin-backdrop" aria-label="Cerrar menú" onClick={() => setOpen(false)} />}
    </>
  );
}
