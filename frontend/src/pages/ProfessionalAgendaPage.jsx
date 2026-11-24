import { useAuth } from '../auth/AuthContext.jsx';
import { getRoleLabel } from '../router/routes.js';

export function ProfessionalAgendaPage() {
  const { session } = useAuth();

  if (!session) {
    return null;
  }

  return (
    <article className="home-panel">
      <h1>Mi agenda</h1>
      <p className="home-panel__lead">Revisa tu jornada y el estado de tus citas.</p>
      <p className="home-panel__status">Sesión activa.</p>
      <dl className="home-panel__details">
        <dt>Usuario</dt>
        <dd>{session.user.email}</dd>
        <dt>Organización</dt>
        <dd>{session.organization.name}</dd>
        <dt>Rol</dt>
        <dd>{getRoleLabel(session.user.role)}</dd>
      </dl>
    </article>
  );
}
