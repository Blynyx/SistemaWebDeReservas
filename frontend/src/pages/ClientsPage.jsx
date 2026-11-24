import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createClient,
  deactivateClient,
  listClients,
  provisionClientAccount,
  updateClient,
} from '../api/clients.api.js';
import { getSafeErrorMessage } from '../utils/apiMessages.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CLIENT_NOT_FOUND = 'El cliente ya no está disponible.';

function isClientActive(client) {
  return client.isActive === 1 || client.isActive === true;
}

function hasLinkedAccount(client) {
  return client.userAccountId != null && client.userAccountId !== '';
}

function displayContact(value, emptyLabel) {
  if (value == null || String(value).trim() === '') {
    return emptyLabel;
  }
  return value;
}

function clientErrorMessage(error, fallback) {
  return getSafeErrorMessage(error, fallback, { notFoundMessage: CLIENT_NOT_FOUND });
}

export function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [busyRowId, setBusyRowId] = useState(null);
  const [editingClient, setEditingClient] = useState(undefined);
  const [accountClient, setAccountClient] = useState(null);

  const requestIdRef = useRef(0);

  const loadClients = useCallback(async ({ keepFeedback = false } = {}) => {
    const currentRequest = ++requestIdRef.current;
    setLoading(true);
    setLoadFailed(false);
    setError('');
    if (!keepFeedback) {
      setFeedback('');
    }

    try {
      const payload = await listClients();
      if (currentRequest !== requestIdRef.current) {
        return;
      }
      setClients(payload.clients ?? []);
    } catch (err) {
      if (currentRequest !== requestIdRef.current) {
        return;
      }
      setLoadFailed(true);
      setError(clientErrorMessage(err, 'No se pudieron cargar los clientes.'));
    } finally {
      if (currentRequest === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  async function handleDeactivate(client) {
    const confirmed = window.confirm(
      '¿Deseas desactivar este cliente?\n\nSi tiene una cuenta de acceso vinculada, también se desactivará.'
    );
    if (!confirmed) {
      return;
    }

    setBusyRowId(client.id);
    setError('');

    try {
      await deactivateClient(client.id);
      setFeedback('Cliente desactivado correctamente.');
      await loadClients({ keepFeedback: true });
    } catch (err) {
      setError(clientErrorMessage(err, 'No se pudo desactivar el cliente.'));
    } finally {
      setBusyRowId(null);
    }
  }

  return (
    <section className="staff-page">
      <h1>Clientes</h1>
      <p className="staff-page__lead">
        Gestiona los clientes de la organización y sus cuentas de acceso.
      </p>

      <div className="clients-toolbar">
        <button
          type="button"
          className="button button--primary"
          disabled={loading}
          onClick={() => setEditingClient(null)}
        >
          Nuevo cliente
        </button>
      </div>

      <p className="panel-feedback" aria-live="polite">
        {feedback}
      </p>
      <p className="panel-error" role="alert">
        {error}
      </p>

      <div className="clients-results">
        {loading && <p className="panel-status">Cargando clientes...</p>}

        {!loading && loadFailed && (
          <div>
            <p className="panel-error" role="alert">
              No se pudieron cargar los clientes.
            </p>
            <button
              type="button"
              className="button button--primary"
              onClick={() => loadClients()}
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !loadFailed && clients.length === 0 && (
          <p className="panel-status">No hay clientes registrados.</p>
        )}

        {!loading && !loadFailed && clients.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Correo de contacto</th>
                  <th scope="col">Teléfono</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Cuenta de acceso</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const active = isClientActive(client);
                  const linked = hasLinkedAccount(client);
                  const isBusy = busyRowId === client.id;

                  return (
                    <tr key={client.id}>
                      <td>{client.name}</td>
                      <td>{displayContact(client.email, 'Sin correo')}</td>
                      <td>{displayContact(client.phone, 'Sin teléfono')}</td>
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
                      <td>{linked ? 'Cuenta vinculada' : 'Sin cuenta'}</td>
                      <td className="data-table__actions">
                        <button
                          type="button"
                          className="button button--small"
                          disabled={isBusy}
                          onClick={() => setEditingClient(client)}
                        >
                          Editar
                        </button>
                        {active && !linked && (
                          <button
                            type="button"
                            className="button button--small"
                            disabled={isBusy}
                            onClick={() => setAccountClient(client)}
                          >
                            Crear cuenta
                          </button>
                        )}
                        {active && (
                          <button
                            type="button"
                            className="button button--small button--danger"
                            disabled={isBusy}
                            onClick={() => handleDeactivate(client)}
                          >
                            Desactivar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ClientFormDialog
        client={editingClient}
        onClose={() => setEditingClient(undefined)}
        onSaved={async (mode) => {
          setEditingClient(undefined);
          setFeedback(
            mode === 'create'
              ? 'Cliente creado correctamente.'
              : 'Cliente actualizado correctamente.'
          );
          await loadClients({ keepFeedback: true });
        }}
      />

      <ClientAccountDialog
        client={accountClient}
        onClose={() => setAccountClient(null)}
        onCreated={async () => {
          setAccountClient(null);
          setFeedback('Cuenta de acceso creada correctamente.');
          await loadClients({ keepFeedback: true });
        }}
      />
    </section>
  );
}

function ClientFormDialog({ client, onClose, onSaved }) {
  const dialogRef = useRef(null);
  const nameRef = useRef(null);
  const emailRef = useRef(null);

  const isOpen = client !== undefined;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (isOpen) {
      setName(client?.name ?? '');
      setEmail(client?.email ?? '');
      setPhone(client?.phone ?? '');
      setError('');
      setBusy(false);
      if (!dialog.open) {
        dialog.showModal();
      }
      nameRef.current?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen, client]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) {
      return;
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      setError('El nombre es obligatorio.');
      nameRef.current?.focus();
      return;
    }

    if (trimmedEmail && !EMAIL_PATTERN.test(trimmedEmail)) {
      setError('El correo de contacto no es válido.');
      emailRef.current?.focus();
      return;
    }

    setBusy(true);
    setError('');

    try {
      const data = {
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
      };
      if (client) {
        await updateClient(client.id, data);
        await onSaved('edit');
      } else {
        await createClient(data);
        await onSaved('create');
      }
    } catch (err) {
      setError(clientErrorMessage(err, 'No se pudo guardar el cliente.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="client-dialog"
      aria-labelledby="client-dialog-title"
      onClose={() => {
        if (isOpen) {
          onClose();
        }
      }}
    >
      <h2 id="client-dialog-title">{client ? 'Editar cliente' : 'Nuevo cliente'}</h2>
      <form className="client-dialog__form" noValidate onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="client-name">Nombre</label>
          <input
            ref={nameRef}
            id="client-name"
            name="client-name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="client-contact-email">Correo de contacto</label>
          <input
            ref={emailRef}
            id="client-contact-email"
            name="client-contact-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="client-phone">Teléfono</label>
          <input
            id="client-phone"
            name="client-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <p className="panel-error" role="alert">
          {error}
        </p>
        <div className="client-dialog__actions">
          <button type="submit" className="button button--primary" disabled={busy}>
            Guardar
          </button>
          <button type="button" className="button button--ghost" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </dialog>
  );
}

function ClientAccountDialog({ client, onClose, onCreated }) {
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

    if (client) {
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
  }, [client]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!client || busy) {
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !EMAIL_PATTERN.test(trimmedEmail)) {
      setError('El correo para iniciar sesión no es válido.');
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
      await provisionClientAccount(client.id, { email: trimmedEmail, password });
      setPassword('');
      await onCreated();
    } catch (err) {
      setPassword('');
      setError(clientErrorMessage(err, 'No se pudo crear la cuenta de acceso.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="client-dialog"
      aria-labelledby="client-account-title"
      onClose={() => {
        setPassword('');
        if (client) {
          onClose();
        }
      }}
    >
      <h2 id="client-account-title">Crear cuenta de acceso</h2>
      <p className="client-dialog__lead">{client?.name ?? ''}</p>
      <p className="client-dialog__hint">
        El correo de inicio de sesión es independiente del correo de contacto del cliente.
      </p>
      <form className="client-dialog__form" noValidate onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="client-login-email">Correo para iniciar sesión</label>
          <input
            ref={emailRef}
            id="client-login-email"
            name="client-login-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="client-login-password">Contraseña</label>
          <input
            ref={passwordRef}
            id="client-login-password"
            name="client-login-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <p className="panel-error" role="alert">
          {error}
        </p>
        <div className="client-dialog__actions">
          <button type="submit" className="button button--primary" disabled={busy}>
            Crear cuenta
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => {
              setPassword('');
              onClose();
            }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </dialog>
  );
}
