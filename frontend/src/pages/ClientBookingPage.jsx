import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/apiClient.js';
import { getAvailability } from '../api/availability.api.js';
import { createMyAppointment } from '../api/self.api.js';
import { listServices } from '../api/services.api.js';
import { AvailabilityResults } from '../components/AvailabilityResults.jsx';
import { getSafeErrorMessage } from '../utils/apiMessages.js';
import { formatLocalDate, formatLocalTime, getTodayLocalDate } from '../utils/dateTime.js';
import { formatPriceMinorUnits } from '../utils/money.js';

export function ClientBookingPage() {
  const navigate = useNavigate();

  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [serviceId, setServiceId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [date, setDate] = useState(() => getTodayLocalDate());
  const [knownProfessionals, setKnownProfessionals] = useState([]);
  const [availability, setAvailability] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [availStatus, setAvailStatus] = useState('');
  const [availError, setAvailError] = useState('');
  const [createError, setCreateError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const availabilityRequestIdRef = useRef(0);

  useEffect(() => {
    let active = true;
    setServicesLoading(true);
    setAvailStatus('Cargando servicios disponibles...');

    (async () => {
      try {
        const res = await listServices();
        if (!active) {
          return;
        }
        const activeServices = (res?.services ?? []).filter(
          (s) => s.isActive === 1 || s.isActive === true
        );
        setServices(activeServices);
        setAvailStatus(
          activeServices.length === 0
            ? 'No hay servicios activos disponibles en este momento.'
            : ''
        );
      } catch (err) {
        if (!active) {
          return;
        }
        setAvailStatus('');
        setAvailError(getSafeErrorMessage(err, 'No se pudieron cargar los servicios.'));
      } finally {
        if (active) {
          setServicesLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const selectedService = services.find((item) => item.id === serviceId) ?? null;

  function invalidateAvailability({ resetProfessionals = false } = {}) {
    availabilityRequestIdRef.current += 1;
    setAvailabilityBusy(false);
    setAvailability(null);
    setSelectedSlot(null);
    setAvailStatus('');
    setAvailError('');
    if (resetProfessionals) {
      setKnownProfessionals([]);
      setProfessionalId('');
    }
  }

  async function queryAvailability({ preserveCreateError = false } = {}) {
    if (availabilityBusy) {
      return;
    }

    if (!serviceId) {
      setAvailStatus('');
      setAvailError('Debes seleccionar un servicio para consultar disponibilidad.');
      return;
    }

    if (!date) {
      setAvailStatus('');
      setAvailError('Debes seleccionar una fecha para consultar disponibilidad.');
      return;
    }

    const reqServiceId = serviceId;
    const reqDate = date;
    const reqProfessionalId = professionalId || undefined;
    const currentReq = ++availabilityRequestIdRef.current;

    setAvailabilityBusy(true);
    setAvailability(null);
    setSelectedSlot(null);
    setAvailError('');
    if (!preserveCreateError) {
      setCreateError('');
    }
    setSuccessMessage('');
    setAvailStatus('Consultando disponibilidad...');

    try {
      const payload = await getAvailability({
        serviceId: reqServiceId,
        date: reqDate,
        professionalId: reqProfessionalId,
      });

      if (currentReq !== availabilityRequestIdRef.current) {
        return;
      }

      setAvailability(payload);
      setAvailStatus('');

      if (!reqProfessionalId && Array.isArray(payload?.professionals)) {
        setKnownProfessionals(
          payload.professionals.map((p) => ({
            id: p.id,
            name: p.name,
          }))
        );
      }
    } catch (err) {
      if (currentReq !== availabilityRequestIdRef.current) {
        return;
      }
      setAvailStatus('');
      setAvailError(getSafeErrorMessage(err, 'No se pudo consultar la disponibilidad.'));
    } finally {
      if (currentReq === availabilityRequestIdRef.current) {
        setAvailabilityBusy(false);
      }
    }
  }

  const canConsult = Boolean(
    !createBusy && !availabilityBusy && !servicesLoading && services.length > 0
  );
  const canConfirm = Boolean(
    !createBusy &&
      !availabilityBusy &&
      selectedSlot &&
      selectedService &&
      availability?.date === date &&
      availability?.service?.id === serviceId
  );

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canConfirm) {
      return;
    }

    setCreateBusy(true);
    setCreateError('');
    setSuccessMessage('');

    try {
      await createMyAppointment({
        professionalId: selectedSlot.professionalId,
        serviceId,
        startAt: selectedSlot.startAt,
      });

      setSelectedSlot(null);
      setAvailability(null);
      setSuccessMessage('Reserva creada correctamente con estado PROGRAMADA.');
    } catch (err) {
      setCreateError(getSafeErrorMessage(err, 'No se pudo registrar tu reserva.'));
      setSelectedSlot(null);

      if (err instanceof ApiError && err.status === 409) {
        await queryAvailability({ preserveCreateError: true });
      }
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <section className="staff-page client-portal">
      <h1>Reservar cita</h1>
      <p className="staff-page__lead">
        Selecciona un servicio, elige fecha y horario disponible para confirmar tu cita.
      </p>

      {successMessage && (
        <div className="client-booking-success" aria-live="polite">
          <p>{successMessage}</p>
          <Link to="/mis-citas" className="button button--primary">
            Ver mis citas
          </Link>
        </div>
      )}

      <form className="client-booking-form" noValidate onSubmit={handleSubmit}>
        <div className="booking-dialog__fields">
          <div className="form-field">
            <label htmlFor="client-booking-service">Servicio *</label>
            <select
              id="client-booking-service"
              required
              disabled={createBusy || servicesLoading || services.length === 0}
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                invalidateAvailability({ resetProfessionals: true });
              }}
            >
              <option value="">Selecciona un servicio</option>
              {services.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.name} ({svc.durationMinutes} min ·{' '}
                  {formatPriceMinorUnits(svc.priceMinorUnits)})
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="client-booking-professional">Profesional</label>
            <select
              id="client-booking-professional"
              disabled={createBusy || servicesLoading || services.length === 0}
              value={professionalId}
              onChange={(e) => {
                setProfessionalId(e.target.value);
                invalidateAvailability({ resetProfessionals: false });
              }}
            >
              <option value="">Cualquier profesional</option>
              {knownProfessionals.map((pro) => (
                <option key={pro.id} value={pro.id}>
                  {pro.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="client-booking-date">Fecha *</label>
            <input
              id="client-booking-date"
              type="date"
              required
              disabled={createBusy || servicesLoading || services.length === 0}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                invalidateAvailability({ resetProfessionals: false });
              }}
            />
          </div>
        </div>

        {selectedService && (
          <section className="client-service-preview" aria-live="polite">
            <strong>{selectedService.name}</strong>
            <span>
              {' '}
              · {selectedService.durationMinutes} min ·{' '}
              {formatPriceMinorUnits(selectedService.priceMinorUnits)}
            </span>
            {selectedService.description ? <p>{selectedService.description}</p> : null}
          </section>
        )}

        <button
          type="button"
          className="button button--primary"
          disabled={!canConsult}
          onClick={() => queryAvailability()}
        >
          {availabilityBusy ? 'Consultando...' : 'Consultar disponibilidad'}
        </button>

        <p className="panel-status" aria-live="polite">
          {availStatus}
        </p>
        <p className="panel-error" role="alert">
          {availError}
        </p>

        <AvailabilityResults
          availability={availability}
          selectedSlot={selectedSlot}
          disabled={createBusy || availabilityBusy}
          onSelectSlot={(slot) => {
            setSelectedSlot(slot);
            setCreateError('');
          }}
        />

        <section className="booking-dialog__summary" aria-live="polite">
          {selectedSlot && selectedService && availability && (
            <>
              <h2>Resumen de tu reserva</h2>
              <dl>
                <div>
                  <dt>Servicio</dt>
                  <dd>{selectedService.name}</dd>
                </div>
                <div>
                  <dt>Profesional</dt>
                  <dd>{selectedSlot.professionalName}</dd>
                </div>
                <div>
                  <dt>Fecha</dt>
                  <dd>{formatLocalDate(selectedSlot.startAt)}</dd>
                </div>
                <div>
                  <dt>Horario</dt>
                  <dd>
                    {formatLocalTime(selectedSlot.startAt)} –{' '}
                    {formatLocalTime(selectedSlot.endAt)}
                  </dd>
                </div>
                <div>
                  <dt>Duración</dt>
                  <dd>{selectedService.durationMinutes} min</dd>
                </div>
                <div>
                  <dt>Precio</dt>
                  <dd>{formatPriceMinorUnits(selectedService.priceMinorUnits)}</dd>
                </div>
              </dl>
            </>
          )}
        </section>

        <p className="panel-error" role="alert">
          {createError}
        </p>

        <div className="booking-dialog__actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={!canConfirm}
          >
            {createBusy ? 'Confirmando...' : 'Confirmar reserva'}
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => navigate('/mis-citas')}
          >
            Ver mis citas
          </button>
        </div>
      </form>
    </section>
  );
}
