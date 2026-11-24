import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  getAppointments,
  markNoShowAppointment,
  rescheduleAppointment,
} from '../api/appointments.api.js';
import { listClients } from '../api/clients.api.js';
import { listProfessionals } from '../api/professionals.api.js';
import { listServices } from '../api/services.api.js';
import { StaffAppointmentBookingDialog } from '../components/StaffAppointmentBookingDialog.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { getSafeErrorMessage } from '../utils/apiMessages.js';
import { getAppointmentActions, STATUS_LABELS } from '../utils/appointmentStatus.js';
import { formatLocalDate, formatLocalTime, isDateTimeLocal } from '../utils/dateTime.js';
import { createNameLookup, sortByName } from '../utils/references.js';

const ACTION_LABELS = {
  confirm: 'Confirmar',
  reschedule: 'Reprogramar',
  cancel: 'Cancelar cita',
  complete: 'Completar',
  noShow: 'No asistió',
};

const SUCCESS_MESSAGES = {
  confirm: 'Cita confirmada correctamente.',
  cancel: 'Cita cancelada correctamente.',
  reschedule: 'Cita reprogramada correctamente.',
  complete: 'Cita completada correctamente.',
  noShow: 'Cita marcada como no asistió.',
};

function confirmMessage(action) {
  if (action === 'cancel') {
    return '¿Deseas cancelar esta cita?';
  }
  if (action === 'confirm') {
    return '¿Deseas confirmar esta cita?';
  }
  if (action === 'complete') {
    return '¿Deseas marcar esta cita como completada?';
  }
  return '¿Deseas marcar esta cita como no asistió?';
}

export function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [services, setServices] = useState([]);
  const [names, setNames] = useState({
    clientName: () => 'Cliente no disponible',
    professionalName: () => 'Profesional no disponible',
    serviceName: () => 'Servicio no disponible',
  });

  const [filterForm, setFilterForm] = useState({
    clientId: '',
    professionalId: '',
    serviceId: '',
    status: '',
    from: '',
    to: '',
  });
  const [currentFilters, setCurrentFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [busyRowId, setBusyRowId] = useState(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);

  const requestIdRef = useRef(0);

  const loadAppointments = useCallback(async (filters, { keepFeedback = false } = {}) => {
    const currentRequest = ++requestIdRef.current;
    setLoading(true);
    setError('');
    if (!keepFeedback) {
      setFeedback('');
    }

    try {
      const payload = await getAppointments(filters);
      if (currentRequest !== requestIdRef.current) {
        return;
      }
      setCurrentFilters(filters);
      setAppointments(payload.appointments ?? []);
    } catch (err) {
      if (currentRequest !== requestIdRef.current) {
        return;
      }
      setError(getSafeErrorMessage(err, 'No se pudieron cargar las citas.'));
    } finally {
      if (currentRequest === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const currentRequest = ++requestIdRef.current;
    setLoading(true);

    (async () => {
      try {
        const [appointmentsResult, clientsResult, professionalsResult, servicesResult] =
          await Promise.all([
            getAppointments({}),
            listClients(),
            listProfessionals(),
            listServices(),
          ]);

        if (currentRequest !== requestIdRef.current) {
          return;
        }

        setClients(clientsResult.clients ?? []);
        setProfessionals(professionalsResult.professionals ?? []);
        setServices(servicesResult.services ?? []);
        setNames({
          clientName: createNameLookup(clientsResult.clients, 'Cliente no disponible'),
          professionalName: createNameLookup(
            professionalsResult.professionals,
            'Profesional no disponible'
          ),
          serviceName: createNameLookup(servicesResult.services, 'Servicio no disponible'),
        });
        setAppointments(appointmentsResult.appointments ?? []);
        setCurrentFilters({});
        setReady(true);
      } catch (err) {
        if (currentRequest !== requestIdRef.current) {
          return;
        }
        setError(getSafeErrorMessage(err, 'No se pudieron cargar las citas.'));
      } finally {
        if (currentRequest === requestIdRef.current) {
          setLoading(false);
        }
      }
    })();
  }, []);

  function validateRange(filters) {
    const fromProvided = Boolean(filters.from);
    const toProvided = Boolean(filters.to);

    if (fromProvided !== toProvided) {
      return fromProvided
        ? 'Debes indicar también la fecha Hasta.'
        : 'Debes indicar también la fecha Desde.';
    }

    if (fromProvided && filters.from > filters.to) {
      return 'La fecha Desde no puede ser posterior a Hasta.';
    }

    return null;
  }

  function handleFilterSubmit(event) {
    event.preventDefault();
    const rangeError = validateRange(filterForm);
    if (rangeError) {
      setError(rangeError);
      return;
    }
    loadAppointments(filterForm);
  }

  function handleClear() {
    const empty = {
      clientId: '',
      professionalId: '',
      serviceId: '',
      status: '',
      from: '',
      to: '',
    };
    setFilterForm(empty);
    setError('');
    setFeedback('');
    loadAppointments({});
  }

  async function handleAction(action, appointment) {
    if (busyRowId === appointment.id) {
      return;
    }

    if (action === 'reschedule') {
      setRescheduleTarget(appointment);
      return;
    }

    const confirmed = window.confirm(confirmMessage(action));
    if (!confirmed) {
      return;
    }

    setBusyRowId(appointment.id);
    setError('');

    try {
      if (action === 'confirm') {
        await confirmAppointment(appointment.id);
      } else if (action === 'cancel') {
        await cancelAppointment(appointment.id);
      } else if (action === 'complete') {
        await completeAppointment(appointment.id);
      } else if (action === 'noShow') {
        await markNoShowAppointment(appointment.id);
      }

      setFeedback(SUCCESS_MESSAGES[action]);
      await loadAppointments(currentFilters, { keepFeedback: true });
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo completar la acción.'));
    } finally {
      setBusyRowId(null);
    }
  }

  return (
    <section className="staff-page">
      <h1>Citas</h1>
      <p className="staff-page__lead">Consulta y gestiona las citas de la organización.</p>

      <div className="staff-page__actions">
        <button
          type="button"
          className="button button--primary"
          disabled={!ready}
          onClick={() => setBookingOpen(true)}
        >
          Nueva cita
        </button>
      </div>

      <form className="filters-form" noValidate onSubmit={handleFilterSubmit}>
        <div className="form-field">
          <label htmlFor="filter-client">Cliente</label>
          <select
            id="filter-client"
            name="filter-client"
            value={filterForm.clientId}
            onChange={(e) => setFilterForm((prev) => ({ ...prev, clientId: e.target.value }))}
          >
            <option value="">Todos los clientes</option>
            {sortByName(clients).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="filter-professional">Profesional</label>
          <select
            id="filter-professional"
            name="filter-professional"
            value={filterForm.professionalId}
            onChange={(e) =>
              setFilterForm((prev) => ({ ...prev, professionalId: e.target.value }))
            }
          >
            <option value="">Todos los profesionales</option>
            {sortByName(professionals).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="filter-service">Servicio</label>
          <select
            id="filter-service"
            name="filter-service"
            value={filterForm.serviceId}
            onChange={(e) => setFilterForm((prev) => ({ ...prev, serviceId: e.target.value }))}
          >
            <option value="">Todos los servicios</option>
            {sortByName(services).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="filter-status">Estado</label>
          <select
            id="filter-status"
            name="filter-status"
            value={filterForm.status}
            onChange={(e) => setFilterForm((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="filter-from">Desde</label>
          <input
            id="filter-from"
            name="filter-from"
            type="date"
            value={filterForm.from}
            onChange={(e) => setFilterForm((prev) => ({ ...prev, from: e.target.value }))}
          />
        </div>

        <div className="form-field">
          <label htmlFor="filter-to">Hasta</label>
          <input
            id="filter-to"
            name="filter-to"
            type="date"
            value={filterForm.to}
            onChange={(e) => setFilterForm((prev) => ({ ...prev, to: e.target.value }))}
          />
        </div>

        <div className="filters-form__actions">
          <button type="submit" className="button button--primary" disabled={loading}>
            Filtrar
          </button>
          <button
            type="button"
            className="button button--ghost"
            disabled={loading}
            onClick={handleClear}
          >
            Limpiar
          </button>
        </div>
      </form>

      <p className="panel-feedback" aria-live="polite">
        {feedback}
      </p>
      <p className="panel-error" role="alert">
        {error}
      </p>

      <div className="appointments-results">
        {loading && <p className="panel-status">Cargando citas...</p>}

        {!loading && error && !ready && (
          <button
            type="button"
            className="button button--primary"
            onClick={() => loadAppointments(currentFilters)}
          >
            Reintentar
          </button>
        )}

        {!loading && (!error || ready) && appointments.length === 0 && (
          <p className="panel-status">
            No se encontraron citas con los filtros seleccionados.
          </p>
        )}

        {!loading && appointments.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Hora</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Profesional</th>
                  <th scope="col">Servicio</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Duración</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => {
                  const isRowBusy = busyRowId === appointment.id;
                  return (
                    <tr key={appointment.id}>
                      <td>{formatLocalDate(appointment.startAt)}</td>
                      <td>{formatLocalTime(appointment.startAt)}</td>
                      <td>{names.clientName(appointment.clientId)}</td>
                      <td>{names.professionalName(appointment.professionalId)}</td>
                      <td>{names.serviceName(appointment.serviceId)}</td>
                      <td>
                        <StatusBadge status={appointment.status} />
                      </td>
                      <td>{appointment.serviceDurationMinutes} min</td>
                      <td className="data-table__actions">
                        {getAppointmentActions(appointment.status).map((action) => (
                          <button
                            key={action}
                            type="button"
                            disabled={isRowBusy}
                            className={
                              action === 'cancel'
                                ? 'button button--small button--danger'
                                : 'button button--small'
                            }
                            onClick={() => handleAction(action, appointment)}
                          >
                            {ACTION_LABELS[action]}
                          </button>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StaffRescheduleDialog
        appointment={rescheduleTarget}
        names={names}
        onClose={() => setRescheduleTarget(null)}
        onRescheduled={async () => {
          setRescheduleTarget(null);
          setFeedback(SUCCESS_MESSAGES.reschedule);
          await loadAppointments(currentFilters, { keepFeedback: true });
        }}
      />

      <StaffAppointmentBookingDialog
        open={bookingOpen}
        clients={clients}
        services={services}
        onClose={() => setBookingOpen(false)}
        onCreated={async () => {
          setFeedback('Cita creada correctamente.');
          await loadAppointments(currentFilters, { keepFeedback: true });
        }}
      />
    </section>
  );
}

function StaffRescheduleDialog({ appointment, names, onClose, onRescheduled }) {
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const [startAt, setStartAt] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (appointment) {
      setStartAt(appointment.startAt);
      setError('');
      setBusy(false);
      if (!dialog.open) {
        dialog.showModal();
      }
      inputRef.current?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [appointment]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!appointment || busy) {
      return;
    }

    const normalized = startAt.slice(0, 16);
    if (!isDateTimeLocal(normalized)) {
      setError('Debes indicar un horario válido.');
      return;
    }

    setBusy(true);
    try {
      await rescheduleAppointment(appointment.id, normalized);
      await onRescheduled();
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo reprogramar la cita.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="reschedule-dialog"
      aria-labelledby="reschedule-title"
      onClose={() => {
        if (appointment) {
          onClose();
        }
      }}
    >
      <h2 id="reschedule-title">Reprogramar cita</h2>
      <p className="reschedule-dialog__summary">
        {appointment
          ? `${names.clientName(appointment.clientId)} · ${formatLocalDate(
              appointment.startAt
            )} ${formatLocalTime(appointment.startAt)}`
          : ''}
      </p>
      <form className="reschedule-dialog__form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="reschedule-startAt">Nuevo horario</label>
          <input
            ref={inputRef}
            id="reschedule-startAt"
            type="datetime-local"
            required
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
          />
        </div>
        <p className="panel-error" role="alert">
          {error}
        </p>
        <div className="reschedule-dialog__actions">
          <button type="submit" className="button button--primary" disabled={busy}>
            Guardar
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
      </form>
    </dialog>
  );
}
