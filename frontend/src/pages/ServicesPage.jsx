import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createService,
  deactivateService,
  listServices,
  updateService,
} from '../api/services.api.js';
import { getSafeErrorMessage } from '../utils/apiMessages.js';

const SERVICE_NOT_FOUND = 'El servicio ya no está disponible.';

function isServiceActive(service) {
  return service.isActive === 1 || service.isActive === true;
}

function displayDescription(value) {
  if (value == null || String(value).trim() === '') {
    return 'Sin descripción';
  }
  return value;
}

function parseIntegerInput(rawValue) {
  const trimmed = String(rawValue).trim();
  if (trimmed === '') {
    return { empty: true, value: null };
  }
  const value = Number(trimmed);
  return { empty: false, value, isInteger: Number.isInteger(value) };
}

function serviceErrorMessage(error, fallback) {
  return getSafeErrorMessage(error, fallback, { notFoundMessage: SERVICE_NOT_FOUND });
}

export function ServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [busyRowId, setBusyRowId] = useState(null);
  const [editingService, setEditingService] = useState(undefined);

  const requestIdRef = useRef(0);

  const loadServices = useCallback(async ({ keepFeedback = false } = {}) => {
    const currentRequest = ++requestIdRef.current;
    setLoading(true);
    setLoadFailed(false);
    setError('');
    if (!keepFeedback) {
      setFeedback('');
    }

    try {
      const payload = await listServices();
      if (currentRequest !== requestIdRef.current) {
        return;
      }
      setServices(payload.services ?? []);
    } catch (err) {
      if (currentRequest !== requestIdRef.current) {
        return;
      }
      setLoadFailed(true);
      setError(serviceErrorMessage(err, 'No se pudieron cargar los servicios.'));
    } finally {
      if (currentRequest === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  async function handleDeactivate(service) {
    const confirmed = window.confirm(
      '¿Deseas desactivar este servicio?\n\nEl servicio dejará de estar disponible para nuevas reservas.'
    );
    if (!confirmed) {
      return;
    }

    setBusyRowId(service.id);
    setError('');

    try {
      await deactivateService(service.id);
      setFeedback('Servicio desactivado correctamente.');
      await loadServices({ keepFeedback: true });
    } catch (err) {
      setError(serviceErrorMessage(err, 'No se pudo desactivar el servicio.'));
    } finally {
      setBusyRowId(null);
    }
  }

  return (
    <section className="staff-page">
      <h1>Servicios</h1>
      <p className="staff-page__lead">Gestiona los servicios ofrecidos por la organización.</p>
      <p className="services-cost-note">
        Valor almacenado en unidades menores; la moneda aún no está configurada.
      </p>

      <div className="services-toolbar">
        <button
          type="button"
          className="button button--primary"
          disabled={loading}
          onClick={() => setEditingService(null)}
        >
          Nuevo servicio
        </button>
      </div>

      <p className="panel-feedback" aria-live="polite">
        {feedback}
      </p>
      <p className="panel-error" role="alert">
        {error}
      </p>

      <div className="services-results">
        {loading && <p className="panel-status">Cargando servicios...</p>}

        {!loading && loadFailed && (
          <div>
            <p className="panel-error" role="alert">
              No se pudieron cargar los servicios.
            </p>
            <button
              type="button"
              className="button button--primary"
              onClick={() => loadServices()}
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !loadFailed && services.length === 0 && (
          <p className="panel-status">No hay servicios registrados.</p>
        )}

        {!loading && !loadFailed && services.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Descripción</th>
                  <th scope="col">Duración</th>
                  <th scope="col">Costo</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => {
                  const active = isServiceActive(service);
                  const isBusy = busyRowId === service.id;

                  return (
                    <tr key={service.id}>
                      <td>{service.name}</td>
                      <td>{displayDescription(service.description)}</td>
                      <td>{service.durationMinutes} min</td>
                      <td>{service.priceMinorUnits} unidades menores</td>
                      <td>
                        <span
                          className={
                            active
                              ? 'status-badge service-status-badge service-status-badge--active'
                              : 'status-badge service-status-badge service-status-badge--inactive'
                          }
                        >
                          {active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="data-table__actions">
                        <button
                          type="button"
                          className="button button--small"
                          disabled={isBusy}
                          onClick={() => setEditingService(service)}
                        >
                          Editar
                        </button>
                        {active && (
                          <button
                            type="button"
                            className="button button--small button--danger"
                            disabled={isBusy}
                            onClick={() => handleDeactivate(service)}
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

      <ServiceFormDialog
        service={editingService}
        onClose={() => setEditingService(undefined)}
        onSaved={async (mode) => {
          setEditingService(undefined);
          setFeedback(
            mode === 'create'
              ? 'Servicio creado correctamente.'
              : 'Servicio actualizado correctamente.'
          );
          await loadServices({ keepFeedback: true });
        }}
      />
    </section>
  );
}

function ServiceFormDialog({ service, onClose, onSaved }) {
  const dialogRef = useRef(null);
  const nameRef = useRef(null);
  const durationRef = useRef(null);
  const priceRef = useRef(null);

  const isOpen = service !== undefined;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [priceMinorUnits, setPriceMinorUnits] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (isOpen) {
      setName(service?.name ?? '');
      setDescription(service?.description ?? '');
      setDurationMinutes(service?.durationMinutes != null ? String(service.durationMinutes) : '');
      setPriceMinorUnits(service?.priceMinorUnits != null ? String(service.priceMinorUnits) : '');
      setError('');
      setBusy(false);
      if (!dialog.open) {
        dialog.showModal();
      }
      nameRef.current?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen, service]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) {
      return;
    }

    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    const duration = parseIntegerInput(durationMinutes);
    const price = parseIntegerInput(priceMinorUnits);

    if (!trimmedName) {
      setError('El nombre es obligatorio.');
      nameRef.current?.focus();
      return;
    }

    if (duration.empty || !duration.isInteger || duration.value <= 0) {
      setError('La duración debe ser un entero mayor que 0.');
      durationRef.current?.focus();
      return;
    }

    if (price.empty || !price.isInteger || price.value < 0) {
      setError('El costo debe ser un entero mayor o igual que 0.');
      priceRef.current?.focus();
      return;
    }

    const data = {
      name: trimmedName,
      description: trimmedDesc === '' ? null : trimmedDesc,
      durationMinutes: duration.value,
      priceMinorUnits: price.value,
    };

    setBusy(true);
    setError('');

    try {
      if (service) {
        await updateService(service.id, data);
        await onSaved('edit');
      } else {
        await createService(data);
        await onSaved('create');
      }
    } catch (err) {
      setError(serviceErrorMessage(err, 'No se pudo guardar el servicio.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="service-dialog"
      aria-labelledby="service-dialog-title"
      onClose={() => {
        if (isOpen) {
          onClose();
        }
      }}
    >
      <h2 id="service-dialog-title">{service ? 'Editar servicio' : 'Nuevo servicio'}</h2>
      <form className="service-dialog__form" noValidate onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="service-name">Nombre</label>
          <input
            ref={nameRef}
            id="service-name"
            name="service-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="service-description">Descripción</label>
          <textarea
            id="service-description"
            name="service-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="service-duration">Duración en minutos</label>
          <input
            ref={durationRef}
            id="service-duration"
            name="service-duration"
            type="number"
            required
            min="1"
            step="1"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="service-price">Costo (unidades menores)</label>
          <input
            ref={priceRef}
            id="service-price"
            name="service-price"
            type="number"
            required
            min="0"
            step="1"
            value={priceMinorUnits}
            onChange={(e) => setPriceMinorUnits(e.target.value)}
          />
        </div>
        <p className="panel-error" role="alert">
          {error}
        </p>
        <div className="service-dialog__actions">
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
