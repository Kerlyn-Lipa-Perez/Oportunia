'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { PauseCircle, PlayCircle, RefreshCw, ShieldCheck, UserPlus, Users } from 'lucide-react';
import type { TeamRole, TeamStatus, TeamUser } from '@/lib/team-management';

const roleLabels: Record<TeamRole, string> = { admin: 'Administrador', editor: 'Editor' };
const statusLabels: Record<TeamStatus, string> = {
  active: 'Activa',
  suspended: 'Suspendida',
  unconfigured: 'Sin acceso',
};

export default function TeamPanel() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/users', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo cargar el equipo.');
      setUsers(Array.isArray(result.users) ? result.users : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el equipo.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusyId('create'); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.get('name'), email: values.get('email'), password: values.get('password'), role: values.get('role'),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo crear la cuenta.');
      form.reset();
      setMessage('Cuenta creada. Compartí la contraseña inicial por un canal seguro.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear la cuenta.');
    } finally { setBusyId(''); }
  }

  async function update(userId: string, change: { role: TeamRole } | { active: boolean }) {
    setBusyId(userId); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...change }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo actualizar la cuenta.');
      setUsers((current) => current.map((user) => user.id === userId ? result.user : user));
      setMessage('Acceso actualizado y sesiones sincronizadas.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la cuenta.');
      await load();
    } finally { setBusyId(''); }
  }

  return <section className="editor-team" aria-labelledby="team-title">
    <div className="editor-team-heading">
      <div><p className="editor-eyebrow">ACCESOS</p><h2 id="team-title">Equipo</h2><p>Administradores gestionan cuentas. Editores trabajan con contenido, campañas, ingesta y analítica.</p></div>
      <button className="editor-secondary" type="button" onClick={() => void load()} disabled={loading || !!busyId}><RefreshCw size={16} /> Actualizar</button>
    </div>
    <form className="editor-team-create" onSubmit={create}>
      <label>Nombre<input name="name" minLength={2} maxLength={120} required autoComplete="off" /></label>
      <label>Correo<input name="email" type="email" required autoComplete="off" /></label>
      <label>Contraseña inicial<input name="password" type="password" minLength={12} required autoComplete="new-password" aria-describedby="initial-password-help" /></label>
      <label>Rol<select name="role" defaultValue="editor"><option value="editor">Editor</option><option value="admin">Administrador</option></select></label>
      <button className="editor-primary" disabled={busyId === 'create'}><UserPlus size={17} /> {busyId === 'create' ? 'Creando…' : 'Crear cuenta'}</button>
      <small id="initial-password-help">Mínimo 12 caracteres. Oportunia no guarda ni vuelve a mostrar esta contraseña.</small>
    </form>
    {error && <p className="editor-error" role="alert">{error}</p>}
    {message && <p className="editor-success" role="status">{message}</p>}
    {loading ? <div className="editor-team-state" role="status"><RefreshCw size={20} /> Cargando equipo…</div>
      : users.length === 0 ? <div className="editor-team-state"><Users size={23} /> No hay cuentas para mostrar.</div>
        : <div className="editor-team-list">{users.map((user) => {
          const disabled = user.isCurrent || busyId === user.id;
          return <article className="editor-team-row" key={user.id}>
            <div className="editor-team-person"><span className="editor-team-avatar" aria-hidden="true">{(user.name || user.email).slice(0, 1).toUpperCase()}</span><div><strong>{user.name || 'Sin nombre'} {user.isCurrent && <small>Vos</small>}</strong><span>{user.email}</span></div></div>
            <div className={`editor-team-status is-${user.status}`}><span />{statusLabels[user.status]}</div>
            <label className="editor-team-role">Alcance<select aria-label={`Rol de ${user.email}`} value={user.role ?? ''} disabled={disabled} onChange={(event) => void update(user.id, { role: event.target.value as TeamRole })}><option value="" disabled>Sin perfil</option><option value="editor">{roleLabels.editor}</option><option value="admin">{roleLabels.admin}</option></select></label>
            <button className={`editor-secondary ${user.status === 'suspended' ? '' : 'editor-danger'}`} type="button" disabled={disabled || user.status === 'unconfigured'} onClick={() => void update(user.id, { active: user.status === 'suspended' })}>{user.status === 'suspended' ? <><PlayCircle size={16} /> Reactivar</> : <><PauseCircle size={16} /> Suspender</>}</button>
            {user.isCurrent && <span className="editor-team-lock"><ShieldCheck size={14} /> Tu cuenta se protege desde otra sesión administradora.</span>}
          </article>;
        })}</div>}
  </section>;
}
