import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/apiClient.js';
import { createAppointment } from '../api/appointments.api.js';
import { getAvailability } from '../api/availability.api.js';
import { getSafeErrorMessage } from '../utils/apiMessages.js';
import { formatLocalDate, formatLocalTime } from '../utils/dateTime.js';
import { sortByName } from '../utils/references.js';

function isActiveRecord(item) {
  return item.isActive === true || item.isActive === 1;
}

export function StaffAppointmentBookingDialog({ open, clients = [], services = [], onClose, onCreated }) {
  const dialogRef = useRef(null);
  const clientSelectRef = useRef(null);
  const availabilityResultsRef = useRef(null);

  const activeClients = sortByName(clients.filter(isActiveRecord));
  const activeServices = sortByName(services.filter(isActiveRecord));

  const [clientId, setClientId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState('');
  const [availability, setAvailability] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState('');
  const [availabilityError, setAvailabilityError] = useState('');
  const [createError, setCreateError] = useState('');

  const requestIdRef = useRef(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open) {
      requestIdRef.current += 1;
      setClientId('');
      setServiceId('');
      setDate('');
      setAvailability(null);
      setSelectedSlot(null);
      setAvailabilityBusy(false);
      setCreateBusy(false);
      setAvailabilityStatus('');
      setAvailabilityError('');
      setCreateError('');
      if (!dialog.open) {
        dialog.showModal();
      }
      clientSelectRef.current?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  const selectedClient = activeClients.find((c) => c.id === clientId) ?? null;
  const selectedService = activeServices.find((s) => s.id === serviceId) ?? null;
  const canConsult = Boolean(serviceId && date && activeClients.length && activeServices.length);
  const canCreate = Boolean(
    !createBusy &&
      !availabilityBusy &&
      selectedService &&
      availability?.date === date &&
      availability?.service?.id === serviceId &&
      selectedSlot
  );

  function invalidateAvailability() {
    requestIdRef.current += 1;
    setAvailabilityBusy(false);
    setAvailability(null);
    setSelectedSlot(null);
    setAvailabilityStatus('');
    setAvailabilityError('');
  }

  async function queryAvailability({ preserveCreateError = false } = {}) {
    if (!canConsult || availabilityBusy) {
      return;
    }

    const reqServiceId = serviceId;
    const reqDate = date;
    const currentRequest = ++requestIdRef.current;

    setAvailabilityBusy(true);
    setAvailability(null);
    setSelectedSlot(null);
    setAvailabilityError('');
    if (!preserveCreateError) {
      setCreateError('');
    }
    setAvailabilityStatus('Consultando disponibilidad...');

    try {
      const payload = await getAvailability({
        serviceId: reqServiceId,
        date: reqDate,
      });

      if (currentRequest !== requestIdRef.current) {
        return;
      }

      setAvailability(payload);
      setAvailabilityStatus('');
      availabilityResultsRef.current?.focus();
    } catch (err) {
      if (currentRequest !== requestIdRef.current) {
        return;
      }
      setAvailabilityStatus('');
      setAvailabilityError(
        getSafeErrorMessage(err, 'No se pudo consultar la disponibilidad.', {
          notFoundMessage: 'El servicio ya no está disponible.',
        })
      );
    } finally {
      if (currentRequest === requestIdRef.current) {
        setAvailabilityBusy(false);
      }
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canCreate) {
      return;
    }

    if (!selectedClient) {
      setCreateError('Debes seleccionar un cliente.');
      clientSelectRef.current?.focus();
      return;
    }

    setCreateBusy(true);
    setCreateError('');

    try {
      const created = await createAppointment({
        clientId,
        professionalId: selectedSlot.professionalId,
        serviceId,
        startAt: selectedSlot.startAt,
      });

      onClose();
      await onCreated?.(created);
    } catch (err) {
      setCreateError(
        getSafeErrorMessage(err, 'No se pudo crear la cita.', {
          notFoundMessage: 'El recurso seleccionado ya no está disponible.',
        })
      );
      setSelectedSlot(null);

      if (err instanceof ApiError && err.status === 409) {
        await queryAvailability({ preserveCreateError: true });
      }
    } finally {
      setCreateBusy(false);
    }
  }

  const professionals = Array.isArray(availability?.professionals)
    ? availability.professionals
    : [];
  const hasAnySlot = professionals.some(
    (p) => Array.isArray(p.slots) && p.slots.length > 0
  );

  return (
    <dialog
      ref={dialogRef}
      className="booking-dialog"
      aria-labelledby="booking-dialog-title"
      onCancel={(e) => {
        if (createBusy) {
          e.preventDefault();
        } else {
          onClose();
        }
      }}
      onClose={() => {
        if (open) {
          onClose();
        }
      }}
    >
      <h2 id="booking-dialog-title">Nueva cita</h2>
      <form className="booking-dialog__form" noValidate onSubmit={handleSubmit}>
        <div className="booking-dialog__fields">
          <div className="form-field">
            <label htmlFor="booking-client">Cliente *</label>
            <select
              ref={clientSelectRef}
              id="booking-client"
              required
              disabled={createBusy || activeClients.length === 0}
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setCreateError('');
              }}
            >
              <option value="">Selecciona un cliente</option>
              {activeClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="booking-service">Servicio *</label>
            <select
              id="booking-service"
              required
              disabled={createBusy || activeServices.length === 0}
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                invalidateAvailability();
              }}
            >
              <option value="">Selecciona un servicio</option>
              {activeServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="booking-date">Fecha *</label>
            <input
              id="booking-date"
              type="date"
              required
              disabled={createBusy || activeClients.length === 0 || activeServices.length === 0}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                invalidateAvailability();
              }}
            />
          </div>
        </div>

        <div className="booking-dialog__reference-status" aria-live="polite">
          {activeClients.length === 0 && (
            <p className="panel-status">No hay clientes activos disponibles.</p>
          )}
          {activeServices.length === 0 && (
            <p className="panel-status">No hay servicios activos disponibles.</p>
          )}
        </div>

        <button
          type="button"
          className="button button--primary"
          disabled={availabilityBusy || createBusy || !canConsult}
          onClick={() => queryAvailability()}
        >
          {availability ? 'Actualizar disponibilidad' : 'Consultar disponibilidad'}
        </button>

        <p className="panel-status" aria-live="polite">
          {availabilityStatus}
        </p>
        <p className="panel-error" role="alert">
          {availabilityError}
        </p>

        <section
          ref={availabilityResultsRef}
          className="booking-dialog__availability"
          aria-label="Disponibilidad"
          tabIndex={-1}
        >
          {availability && professionals.length === 0 && (
            <p className="panel-status">
              No hay profesionales habilitados para este servicio.
            </p>
          )}
          {availability && professionals.length > 0 && !hasAnySlot && (
            <p className="panel-status">No hay horarios disponibles para esta fecha.</p>
          )}
          {availability &&
            professionals.map((professional) => {
              const slots = Array.isArray(professional.slots) ? professional.slots : [];
              return (
                <section key={professional.id} className="booking-professional">
                  <h3>{professional.name}</h3>
                  {slots.length === 0 ? (
                    <p className="panel-status">
                      Sin horarios disponibles para esta fecha.
                    </p>
                  ) : (
                    <div
                      className="booking-slots"
                      role="radiogroup"
                      aria-label={`Horarios de ${professional.name}`}
                    >
                      {slots.map((slot) => {
                        const slotKey = `${professional.id}|${slot.startAt}`;
                        const isSelected =
                          selectedSlot?.professionalId === professional.id &&
                          selectedSlot?.startAt === slot.startAt;

                        return (
                          <label
                            key={slotKey}
                            className={
                              isSelected
                                ? 'booking-slot booking-slot--selected'
                                : 'booking-slot'
                            }
                          >
                            <input
                              type="radio"
                              name="booking-slot"
                              value={slotKey}
                              checked={isSelected}
                              disabled={createBusy || availabilityBusy}
                              onChange={() => {
                                setSelectedSlot({
                                  professionalId: professional.id,
                                  professionalName: professional.name,
                                  startAt: slot.startAt,
                                  endAt: slot.endAt,
                                });
                                setCreateError('');
                              }}
                            />
                            <span>
                              {formatLocalTime(slot.startAt)} – {formatLocalTime(slot.endAt)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
        </section>

        <section className="booking-dialog__summary" aria-live="polite">
          {selectedSlot && availability && selectedClient && selectedService && (
            <>
              <h3>Resumen</h3>
              <dl>
                <div>
                  <dt>Cliente</dt>
                  <dd>{selectedClient.name}</dd>
                </div>
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
                  <dd>{availability.service.durationMinutes} min</dd>
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
            disabled={!canCreate}
          >
            Crear cita
          </button>
          <button
            type="button"
            className="button button--ghost"
            disabled={createBusy}
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
      </form>
    </dialog>
  );
}
