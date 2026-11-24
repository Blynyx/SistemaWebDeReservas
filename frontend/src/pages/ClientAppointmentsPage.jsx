import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  cancelMyAppointment,
  getMyClient,
  getMyClientAppointments,
} from '../api/self.api.js';
import { listServices } from '../api/services.api.js';
import { AppointmentCard } from '../components/AppointmentCard.jsx';
import { RescheduleDialog } from '../components/RescheduleDialog.jsx';
import { getSafeErrorMessage } from '../utils/apiMessages.js';
import { STATUS_LABELS } from '../utils/appointmentStatus.js';
import { formatLocalDate, formatLocalTime } from '../utils/dateTime.js';
import { createNameLookup } from '../utils/references.js';

export function ClientAppointmentsPage() {
  const [clientProfile, setClientProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [serviceLookup, setServiceLookup] = useState(() => (id) => `Servicio (${id})`);
  const [filterForm, setFilterForm] = useState({
    status: '',
    from: '',
    to: '',
  });
  const [currentFilters, setCurrentFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [busyAppointmentId, setBusyAppointmentId] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);

  const requestIdRef = useRef(0);

  const loadData = useCallback(async (filters = {}, { keepFeedback = false } = {}) => {
    const currentRequest = ++requestIdRef.current;
    setLoading(true);
    setError('');
    if (!keepFeedback) {
      setFeedback('');
    }

    try {
      const [appointmentsRes, clientRes, servicesRes] = await Promise.all([
        getMyClientAppointments(filters),
        getMyClient().catch(() => null),
        listServices().catch(() => ({ services: [] })),
      ]);

      if (currentRequest !== requestIdRef.current) {
        return;
      }

      const rawLookup = createNameLookup(servicesRes?.services ?? [], '');
      setServiceLookup(() => (id) => {
        const resolved = rawLookup(id);
        return resolved ? resolved : `Servicio (${id})`;
      });
      setClientProfile(clientRes?.client ?? null);
      setAppointments(appointmentsRes?.appointments ?? []);
      setCurrentFilters(filters);
    } catch (err) {
      if (currentRequest !== requestIdRef.current) {
        return;
      }
      setError(getSafeErrorMessage(err, 'No se pudieron cargar tus citas.'));
    } finally {
      if (currentRequest === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadData({});
  }, [loadData]);

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
    loadData(filterForm);
  }

  function handleClearFilters() {
    const empty = { status: '', from: '', to: '' };
    setFilterForm(empty);
    setError('');
    setFeedback('');
    loadData({});
  }

  async function handleCancel(appointment) {
    const confirmed = window.confirm(
      `¿Deseas cancelar la cita del ${formatLocalDate(
        appointment.startAt
      )} a las ${formatLocalTime(appointment.startAt)}?`
    );
    if (!confirmed) {
      return;
    }

    setBusyAppointmentId(appointment.id);
    setFeedback('');
    setError('');

    try {
      await cancelMyAppointment(appointment.id);
      setFeedback('Cita cancelada correctamente.');
      await loadData(currentFilters, { keepFeedback: true });
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo cancelar la cita.'));
    } finally {
      setBusyAppointmentId(null);
    }
  }

  const profileMeta = clientProfile
    ? [clientProfile.email, clientProfile.phone].filter(Boolean).join(' · ')
    : '';

  return (
    <section className="staff-page client-portal">
      <div className="client-portal__header">
        <div>
          <h1>Mis citas</h1>
          <p className="staff-page__lead">
            Consulta el estado de tus reservas, reprograma o cancela citas activas.
          </p>
        </div>
        <Link to="/reservar" className="button button--primary">
          Reservar cita
        </Link>
      </div>

      {clientProfile && (
        <section className="client-profile-summary" aria-label="Datos del cliente">
          <strong>{clientProfile.name}</strong>
          {profileMeta ? <span> · {profileMeta}</span> : null}
        </section>
      )}

      <form className="filters-form" noValidate onSubmit={handleFilterSubmit}>
        <div className="form-field">
          <label htmlFor="client-filter-status">Estado</label>
          <select
            id="client-filter-status"
            name="client-filter-status"
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
          <label htmlFor="client-filter-from">Desde</label>
          <input
            id="client-filter-from"
            name="client-filter-from"
            type="date"
            value={filterForm.from}
            onChange={(e) => setFilterForm((prev) => ({ ...prev, from: e.target.value }))}
          />
        </div>

        <div className="form-field">
          <label htmlFor="client-filter-to">Hasta</label>
          <input
            id="client-filter-to"
            name="client-filter-to"
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
            onClick={handleClearFilters}
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
        {loading && <p className="panel-status">Cargando tus citas...</p>}

        {!loading && appointments.length === 0 && !error && (
          <p className="panel-status">No tienes citas registradas.</p>
        )}

        {!loading && appointments.length > 0 && (
          <div className="client-appointments-list">
            {appointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                serviceName={serviceLookup(appointment.serviceId)}
                busy={busyAppointmentId === appointment.id}
                onReschedule={(appt) => {
                  setFeedback('');
                  setError('');
                  setRescheduleTarget(appt);
                }}
                onCancel={handleCancel}
              />
            ))}
          </div>
        )}
      </div>

      <RescheduleDialog
        appointment={rescheduleTarget}
        serviceName={rescheduleTarget ? serviceLookup(rescheduleTarget.serviceId) : ''}
        onClose={() => setRescheduleTarget(null)}
        onRescheduled={async () => {
          setRescheduleTarget(null);
          setFeedback('Cita reprogramada correctamente.');
          await loadData(currentFilters, { keepFeedback: true });
        }}
      />
    </section>
  );
}
