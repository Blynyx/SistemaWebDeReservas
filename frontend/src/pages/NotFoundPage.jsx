import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { getRoleHomePath } from '../router/routes.js';

export function NotFoundPage() {
  const { session } = useAuth();
  const homePath = session ? getRoleHomePath(session.user.role) : '/login';

  return (
    <article className="home-panel">
      <h1>Página no encontrada</h1>
      <p>La ruta solicitada no existe en esta etapa.</p>
      <Link className="button button--primary" to={homePath}>
        Volver al inicio
      </Link>
    </article>
  );
}
