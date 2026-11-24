import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createReceptionist,
  listReceptionists,
  setReceptionistActiveState,
} from '../api/receptionists.api.js';
import { getSafeErrorMessage } from '../utils/apiMessages.js';
import { formatIsoTimestamp } from '../utils/dateTime.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RECEPTIONIST_NOT_FOUND = 'La cuenta de recepción ya no está disponible.';

function receptionistErrorMessage(error, fallback) {
  return getSafeErrorMessage(error, fallback, { notFoundMessage: RECEPTIONIST_NOT_FOUND });
}

export function ReceptionistsPage() {
  const [receptionists, setReceptionists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [busyRowId, setBusyRowId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const requestIdRef = useRef(0);

  const loadReceptionists = useCallback(async ({ keepFeedback = false } = {}) => {
    const currentRequest = ++requestIdRef.current;
    setLoading(true);
    setLoadFailed(false);
    setError('');
    if (!keepFeedback) {
      setFeedback('');
    }

    try {
      const payload = await listReceptionists();
      if (currentRequest !== requestIdRef.current) {
        return;
      }
      setReceptionists(payload?.receptionists ?? []);
    } catch (err) {
      if (currentRequest !== requestIdRef.current) {
        return;
      }
      setLoadFailed(true);
      setError(receptionistErrorMessage(err, 'No se pudieron cargar las cuentas de recepción.'));
    } finally {
      if (currentRequest === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadReceptionists();
  }, [loadReceptionists]);

  async function handleToggleStatus(receptionist) {
    const nextActive = !receptionist.isActive;

    if (!nextActive) {
      const confirmed = window.confirm(
        `¿Deseas desactivar la cuenta de recepción ${receptionist.email}?`
      );
      if (!confirmed) {
        return;
      }
    }

    setBusyRowId(receptionist.id);
    setError('');

    try {
      await setReceptionistActiveState(receptionist.id, nextActive);
      setFeedback(
        nextActive
          ? 'Cuenta reactivada correctamente.'
          : 'Cuenta desactivada correctamente.'
      );
      await loadReceptionists({ keepFeedback: true });
    } catch (err) {
      setError(
        receptionistErrorMessage(
          err,
          nextActive
            ? 'No se pudo reactivar la cuenta.'
            : 'No se pudo desactivar la cuenta.'
        )
      );
    } finally {
      setBusyRowId(null);
    }
  }

  return (
    <section className="staff-page">
      <h1>Recepcionistas</h1>
      <p className="staff-page__lead">
        Gestiona las cuentas de acceso con rol de recepción de tu organización.
      </p>

      <div className="clients-toolbar">
        <button
          type="button"
          className="button button--primary"
          disabled={loading}
          onClick={() => setDialogOpen(true)}
        >
          Nuevo recepcionista
        </button>
      </div>

      <p className="panel-feedback" aria-live="polite">
        {feedback}
      </p>
      <p className="panel-error" role="alert">
        {error}
      </p>

      <div className="clients-results">
        {loading && <p className="panel-status">Cargando recepcionistas...</p>}

        {!loading && loadFailed && (
          <div>
            <p className="panel-error" role="alert">
              No se pudieron cargar las cuentas de recepción.
            </p>
            <button
              type="button"
              className="button button--primary"
              onClick={() => loadReceptionists()}
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !loadFailed && receptionists.length === 0 && (
          <p className="panel-status">No hay cuentas de recepción registradas.</p>
        )}

        {!loading && !loadFailed && receptionists.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Correo</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Fecha de creación</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {receptionists.map((item) => {
                  const active = Boolean(item.isActive);
                  const isBusy = busyRowId === item.id;

                  return (
                    <tr key={item.id}>
                      <td>{item.email}</td>
                      <td>Recepcionista</td>
                      <td>
                        <span
                          className={
                            active
                              ? 'status-badge client-status-badge client-status-badge--active'
                              : 'status-badge client-status-badge client-status-badge--inactive'
                          }
                        >
                          {active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>{item.createdAt ? formatIsoTimestamp(item.createdAt) : '—'}</td>
                      <td className="data-table__actions">
                        <button
                          type="button"
                          className={
                            active
                              ? 'button button--small button--danger'
                              : 'button button--small button--primary'
                          }
                          disabled={isBusy}
                          onClick={() => handleToggleStatus(item)}
                        >
                          {active ? 'Desactivar' : 'Reactivar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateReceptionistDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={async () => {
          setDialogOpen(false);
          setFeedback('Cuenta de recepción creada correctamente.');
          await loadReceptionists({ keepFeedback: true });
        }}
      />
    </section>
  );
}

function CreateReceptionistDialog({ open, onClose, onCreated }) {
  const dialogRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open) {
      setEmail('');
      setPassword('');
      setError('');
      setBusy(false);
      if (!dialog.open) {
        dialog.showModal();
      }
      emailRef.current?.focus();
    } else if (dialog.open) {
      setPassword('');
      dialog.close();
    }
  }, [open]);

  function handleClose() {
    setPassword('');
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) {
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !EMAIL_PATTERN.test(trimmedEmail)) {
      setError('El correo electrónico no es válido.');
      emailRef.current?.focus();
      return;
    }

    if (!password || password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      passwordRef.current?.focus();
      return;
    }

    setBusy(true);
    setError('');

    try {
      await createReceptionist({ email: trimmedEmail, password });
      setPassword('');
      await onCreated();
    } catch (err) {
      setPassword('');
      setError(receptionistErrorMessage(err, 'No se pudo crear la cuenta de recepción.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="client-dialog"
      aria-labelledby="receptionist-dialog-title"
      onCancel={(e) => {
        if (busy) {
          e.preventDefault();
        } else {
          handleClose();
        }
      }}
      onClose={() => {
        setPassword('');
        if (open) {
          onClose();
        }
      }}
    >
      <h2 id="receptionist-dialog-title">Nuevo recepcionista</h2>
      <form className="client-dialog__form" noValidate onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="receptionist-email">Correo *</label>
          <input
            ref={emailRef}
            id="receptionist-email"
            name="receptionist-email"
            type="email"
            autoComplete="username"
            required
            disabled={busy}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="receptionist-password">Contraseña *</label>
          <input
            ref={passwordRef}
            id="receptionist-password"
            name="receptionist-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={busy}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <p className="panel-error" role="alert">
          {error}
        </p>
        <div className="client-dialog__actions">
          <button type="submit" className="button button--primary" disabled={busy}>
            {busy ? 'Creando...' : 'Crear cuenta'}
          </button>
          <button
            type="button"
            className="button button--ghost"
            disabled={busy}
            onClick={handleClose}
          >
            Cancelar
          </button>
        </div>
      </form>
    </dialog>
  );
}
