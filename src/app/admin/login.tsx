'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { createAuthClient } from '@neondatabase/auth/next';
import { ArrowLeft, LogOut, ShieldCheck } from 'lucide-react';

const authClient = createAuthClient();

export default function AdminLogin({ access }: { access: 'unauthenticated' | 'forbidden' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data = new FormData(event.currentTarget);
    try { const { error: authError } = await authClient.signIn.email({ email: String(data.get('email') || ''), password: String(data.get('password') || '') }); if (authError) throw new Error(authError.message || 'No se pudo iniciar sesión.'); window.location.reload(); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.'); } finally { setBusy(false); }
  }

  return (
    <div className="editor-app">
    <header className="editor-header"><Link className="editor-brand" href="/">oportunia<span>EDITORIAL</span></Link><Link href="/" className="editor-back"><ArrowLeft size={16} /> Ver portal</Link>{access !== 'unauthenticated' && <button className="editor-secondary" onClick={async () => { const { error: authError } = await authClient.signOut(); if (authError) setError(authError.message || 'No se pudo cerrar sesión.'); else window.location.reload(); }}><LogOut size={16} /> Salir</button>}</header>
<main className="editor-login"><div className="editor-icon"><ShieldCheck size={28} /></div><h1>Tu espacio editorial</h1><p>Información clara empieza con una buena revisión.</p>{access === 'forbidden' ? <div className="editor-notice"><h2>Cuenta sin permiso editorial</h2><p>Tu sesión es válida, pero esta cuenta no tiene un perfil activo de administrador o editor. Pedí a un administrador que habilite tu acceso.</p></div> : <form onSubmit={login}><label>Correo editorial<input name="email" type="email" required autoComplete="username" placeholder="editor@oportunia.pe" /></label><label>Contraseña<input name="password" type="password" required autoComplete="current-password" /></label>{error && <p role="alert" className="editor-error">{error}</p>}<button className="editor-primary" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button></form>}</main>
    </div>
  );
}
