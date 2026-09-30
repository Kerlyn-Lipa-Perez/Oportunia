import { requireEditorial } from '@/lib/auth';
import TeamPanel from '../team-panel';

export default async function EquipoPage() {
  const access = await requireEditorial();
  if (access.kind !== 'admin') {
    return (
      <div className="editor-main">
        <div className="editor-notice"><h2>Acceso restringido</h2><p>Solo una cuenta administradora puede gestionar las cuentas y roles de la redacción. Pide acceso al equipo de Oportunia.</p></div>
      </div>
    );
  }

  return (
    <div className="editor-main">
      <TeamPanel />
    </div>
  );
}
