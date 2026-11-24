import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { getRoleHomePath } from '../router/routes.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { session, login, authMessage } = useAuth();
  const navigate = useNavigate();

  const [organizationSlug, setOrganizationSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(authMessage || '');
  const [submitting, setSubmitting] = useState(false);

  const slugRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  useEffect(() => {
    if (authMessage) {
      setError(authMessage);
    }
  }, [authMessage]);

  if (session) {
    return <Navigate to={getRoleHomePath(session.user.role)} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const trimmedSlug = organizationSlug.trim();
    const trimmedEmail = email.trim();

    if (!trimmedSlug) {
      setError('La organización es obligatoria.');
      slugRef.current?.focus();
      return;
    }

    if (!trimmedEmail || !EMAIL_PATTERN.test(trimmedEmail)) {
      setError('El correo electrónico no es válido.');
      emailRef.current?.focus();
      return;
    }

    if (!password) {
      setError('La contraseña es obligatoria.');
      passwordRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const current = await login({
        organizationSlug: trimmedSlug,
        email: trimmedEmail,
        password,
      });
      setPassword('');
      navigate(getRoleHomePath(current.user.role), { replace: true });
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión.');
      setSubmitting(false);
    }
  }

  return (
    <section className="login-page">
      <div className="login-card">
        <h1>Sistema Web de Reservas</h1>
        <p className="login-card__subtitle">Inicia sesión para continuar</p>
        <form className="login-form" noValidate onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="organizationSlug">Organización</label>
            <input
              ref={slugRef}
              id="organizationSlug"
              name="organizationSlug"
              type="text"
              autoComplete="organization"
              required
              value={organizationSlug}
              onChange={(e) => setOrganizationSlug(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="email">Correo electrónico</label>
            <input
              ref={emailRef}
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="password">Contraseña</label>
            <input
              ref={passwordRef}
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <p className="form-error" id="login-error" role="alert" aria-live="polite">
            {error}
          </p>
          <button
            type="submit"
            className="button button--primary"
            disabled={submitting}
          >
            {submitting ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </section>
  );
}
