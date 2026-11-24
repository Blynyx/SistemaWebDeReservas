import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createProfessional,
  deactivateProfessional,
  listProfessionals,
  provisionProfessionalAccount,
  updateProfessional,
} from '../api/professionals.api.js';
import { ProfessionalConfigurationDialog } from '../components/ProfessionalConfigurationDialog.jsx';
import { getSafeErrorMessage } from '../utils/apiMessages.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROFESSIONAL_NOT_FOUND = 'El profesional ya no está disponible.';

function isProfessionalActive(professional) {
  return professional.isActive === 1 || professional.isActive === true;
}

function hasLinkedAccount(professional) {
  return professional.userAccountId != null && professional.userAccountId !== '';
}

function hasStoredContact(value) {
  return value != null && String(value).trim() !== '';
}

function displayContact(value, emptyLabel) {
  if (!hasStoredContact(value)) {
    return emptyLabel;
  }
  return value;
}

function buildCreatePayload(name, email, phone) {
  const data = { name };
  if (email) {
    data.email = email;
  }
  if (phone) {
    data.phone = phone;
  }
  return data;
}

function buildPatchPayload(professional, name, email, phone) {
  if (hasStoredContact(professional.email) && !email) {
    return {
      error: 'El correo no puede quedar vacío al editar este profesional.',
      focus: 'email',
    };
  }
  if (hasStoredContact(professional.phone) && !phone) {
    return {
      error: 'El teléfono no puede quedar vacío al editar este profesional.',
      focus: 'phone',
    };
  }
  const data = { name };
  if (email) {
    data.email = email;
  }
  if (phone) {
    data.phone = phone;
  }
  return { data };
}

function professionalErrorMessage(error, fallback) {
  return getSafeErrorMessage(error, fallback, { notFoundMessage: PROFESSIONAL_NOT_FOUND });
}

export function ProfessionalsPage() {
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [busyRowId, setBusyRowId] = useState(null);
  const [editingProfessional, setEditingProfessional] = useState(undefined);
  const [accountProfessional, setAccountProfessional] = useState(null);
  const [configProfessional, setConfigProfessional] = useState(null);

  const requestIdRef = useRef(0);

  const loadProfessionals = useCallback(async ({ keepFeedback = false } = {}) => {
    const currentRequest = ++requestIdRef.current;
    setLoading(true);
    setLoadFailed(false);
    setError('');
    if (!keepFeedback) {
      setFeedback('');
    }

    try {
      const payload = await listProfessionals();
      if (currentRequest !== requestIdRef.current) {
        return;
      }
      setProfessionals(payload.professionals ?? []);
    } catch (err) {
      if (currentRequest !== requestIdRef.current) {
        return;
      }
      setLoadFailed(true);
      setError(professionalErrorMessage(err, 'No se pudieron cargar los profesionales.'));
    } finally {
      if (currentRequest === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadProfessionals();
  }, [loadProfessionals]);

  async function handleDeactivate(professional) {
    const confirmed = window.confirm(
      '¿Deseas desactivar este profesional?\n\nSi tiene una cuenta de acceso vinculada, también se desactivará.'
    );
    if (!confirmed) {
      return;
    }

    setBusyRowId(professional.id);
    setError('');

    try {
      await deactivateProfessional(professional.id);
      setFeedback('Profesional desactivado correctamente.');
      await loadProfessionals({ keepFeedback: true });
    } catch (err) {
      setError(professionalErrorMessage(err, 'No se pudo desactivar el profesional.'));
    } finally {
      setBusyRowId(null);
    }
  }

  return (
    <section className="staff-page">
      <h1>Profesionales</h1>
      <p className="staff-page__lead">
        Gestiona los profesionales de la organización y sus cuentas de acceso.
      </p>

      <div className="professionals-toolbar">
        <button
          type="button"
          className="button button--primary"
          disabled={loading}
          onClick={() => setEditingProfessional(null)}
        >
          Nuevo profesional
        </button>
      </div>

      <p className="panel-feedback" aria-live="polite">
        {feedback}
      </p>
      <p className="panel-error" role="alert">
        {error}
      </p>

      <div className="professionals-results">
        {loading && <p className="panel-status">Cargando profesionales...</p>}

        {!loading && loadFailed && (
          <div>
            <p className="panel-error" role="alert">
              No se pudieron cargar los profesionales.
            </p>
            <button
              type="button"
              className="button button--primary"
              onClick={() => loadProfessionals()}
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !loadFailed && professionals.length === 0 && (
          <p className="panel-status">No hay profesionales registrados.</p>
        )}

        {!loading && !loadFailed && professionals.length > 0 && (
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
                {professionals.map((professional) => {
                  const active = isProfessionalActive(professional);
                  const linked = hasLinkedAccount(professional);
                  const isBusy = busyRowId === professional.id;

                  return (
                    <tr key={professional.id}>
                      <td>{professional.name}</td>
                      <td>{displayContact(professional.email, 'Sin correo')}</td>
                      <td>{displayContact(professional.phone, 'Sin teléfono')}</td>
                      <td>
                        <span
                          className={
                            active
                              ? 'status-badge professional-status-badge professional-status-badge--active'
                              : 'status-badge professional-status-badge professional-status-badge--inactive'
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
                          onClick={() => setEditingProfessional(professional)}
                        >
                          Editar
                        </button>
                        {active && !linked && (
                          <button
                            type="button"
                            className="button button--small"
                            disabled={isBusy}
                            onClick={() => setAccountProfessional(professional)}
                          >
                            Crear cuenta
                          </button>
                        )}
                        {active && (
                          <>
                            <button
                              type="button"
                              className="button button--small"
                              disabled={isBusy}
                              onClick={() => setConfigProfessional(professional)}
                            >
                              Configurar
                            </button>
                            <button
                              type="button"
                              className="button button--small button--danger"
                              disabled={isBusy}
                              onClick={() => handleDeactivate(professional)}
                            >
                              Desactivar
                            </button>
                          </>
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

      <ProfessionalFormDialog
        professional={editingProfessional}
        onClose={() => setEditingProfessional(undefined)}
        onSaved={async (mode) => {
          setEditingProfessional(undefined);
          setFeedback(
            mode === 'create'
              ? 'Profesional creado correctamente.'
              : 'Profesional actualizado correctamente.'
          );
          await loadProfessionals({ keepFeedback: true });
        }}
      />

      <ProfessionalAccountDialog
        professional={accountProfessional}
        onClose={() => setAccountProfessional(null)}
        onCreated={async () => {
          setAccountProfessional(null);
          setFeedback('Cuenta de acceso creada correctamente.');
          await loadProfessionals({ keepFeedback: true });
        }}
      />

      <ProfessionalConfigurationDialog
        professional={configProfessional}
        onClose={() => setConfigProfessional(null)}
      />
    </section>
  );
}

function ProfessionalFormDialog({ professional, onClose, onSaved }) {
  const dialogRef = useRef(null);
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const phoneRef = useRef(null);

  const isOpen = professional !== undefined;
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
      setName(professional?.name ?? '');
      setEmail(professional?.email ?? '');
      setPhone(professional?.phone ?? '');
      setError('');
      setBusy(false);
      if (!dialog.open) {
        dialog.showModal();
      }
      nameRef.current?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen, professional]);

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

    let data;
    if (professional) {
      const patch = buildPatchPayload(professional, trimmedName, trimmedEmail, trimmedPhone);
      if (patch.error) {
        setError(patch.error);
        if (patch.focus === 'email') {
          emailRef.current?.focus();
        } else {
          phoneRef.current?.focus();
        }
        return;
      }
      data = patch.data;
    } else {
      data = buildCreatePayload(trimmedName, trimmedEmail, trimmedPhone);
    }

    setBusy(true);
    setError('');

    try {
      if (professional) {
        await updateProfessional(professional.id, data);
        await onSaved('edit');
      } else {
        await createProfessional(data);
        await onSaved('create');
      }
    } catch (err) {
      setError(professionalErrorMessage(err, 'No se pudo guardar el profesional.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="professional-dialog"
      aria-labelledby="professional-dialog-title"
      onClose={() => {
        if (isOpen) {
          onClose();
        }
      }}
    >
      <h2 id="professional-dialog-title">
        {professional ? 'Editar profesional' : 'Nuevo profesional'}
      </h2>
      <form className="professional-dialog__form" noValidate onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="professional-name">Nombre</label>
          <input
            ref={nameRef}
            id="professional-name"
            name="professional-name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="professional-contact-email">Correo de contacto</label>
          <input
            ref={emailRef}
            id="professional-contact-email"
            name="professional-contact-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="professional-phone">Teléfono</label>
          <input
            ref={phoneRef}
            id="professional-phone"
            name="professional-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <p className="panel-error" role="alert">
          {error}
        </p>
        <div className="professional-dialog__actions">
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

function ProfessionalAccountDialog({ professional, onClose, onCreated }) {
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

    if (professional) {
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
  }, [professional]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!professional || busy) {
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
      await provisionProfessionalAccount(professional.id, {
        email: trimmedEmail,
        password,
      });
      setPassword('');
      await onCreated();
    } catch (err) {
      setPassword('');
      setError(professionalErrorMessage(err, 'No se pudo crear la cuenta de acceso.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="professional-dialog"
      aria-labelledby="professional-account-title"
      onClose={() => {
        setPassword('');
        if (professional) {
          onClose();
        }
      }}
    >
      <h2 id="professional-account-title">Crear cuenta de acceso</h2>
      <p className="professional-dialog__lead">{professional?.name ?? ''}</p>
      <p className="professional-dialog__hint">
        El correo de inicio de sesión es independiente del correo de contacto del profesional.
      </p>
      <form className="professional-dialog__form" noValidate onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="professional-login-email">Correo para iniciar sesión</label>
          <input
            ref={emailRef}
            id="professional-login-email"
            name="professional-login-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="professional-login-password">Contraseña</label>
          <input
            ref={passwordRef}
            id="professional-login-password"
            name="professional-login-password"
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
        <div className="professional-dialog__actions">
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
