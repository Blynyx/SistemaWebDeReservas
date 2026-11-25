import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/apiClient.js';
import { getAvailability } from '../api/availability.api.js';
import { rescheduleMyAppointment } from '../api/self.api.js';
import { getSafeErrorMessage } from '../utils/apiMessages.js';
import { formatLocalDate, formatLocalTime, getTodayLocalDate } from '../utils/dateTime.js';

export function RescheduleDialog({ appointment, serviceName, onClose, onRescheduled }) {
  const dialogRef = useRef(null);
  const dateInputRef = useRef(null);

  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [hasQueried, setHasQueried] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [availStatus, setAvailStatus] = useState('');
  const [availError, setAvailError] = useState('');
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (appointment) {
      const initialDate = appointment.startAt.slice(0, 10) || getTodayLocalDate();
      setDate(initialDate);
      setSlots([]);
      setHasQueried(false);
      setSelectedSlot(null);
      setAvailabilityBusy(false);
      setSubmitBusy(false);
      setAvailStatus('');
      setAvailError('');
      setSubmitError('');
      if (!dialog.open) {
        dialog.showModal();
      }
      dateInputRef.current?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [appointment]);

  async function querySlots({ preserveSubmitError = false } = {}) {
    if (!appointment || !date || availabilityBusy) {
      return;
    }

    setAvailabilityBusy(true);
    setSelectedSlot(null);
    setSlots([]);
    setHasQueried(false);
    setAvailError('');
    if (!preserveSubmitError) {
      setSubmitError('');
    }
    setAvailStatus('Consultando disponibilidad...');

    try {
      const payload = await getAvailability({
        serviceId: appointment.serviceId,
        professionalId: appointment.professionalId,
        date,
      });

      const prof = (payload?.professionals ?? [])[0];
      const availableSlots = Array.isArray(prof?.slots) ? prof.slots : [];
      setSlots(availableSlots);
      setHasQueried(true);
      setAvailStatus(
        availableSlots.length === 0
          ? 'No hay horarios disponibles para la fecha seleccionada.'
          : ''
      );
    } catch (err) {
      setAvailStatus('');
      setAvailError(getSafeErrorMessage(err, 'No se pudo consultar la disponibilidad.'));
    } finally {
      setAvailabilityBusy(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!appointment || !selectedSlot || submitBusy) {
      return;
    }

    setSubmitBusy(true);
    setSubmitError('');

    try {
      const updated = await rescheduleMyAppointment(appointment.id, selectedSlot.startAt);
      onClose();
      await onRescheduled?.(updated);
    } catch (err) {
      setSubmitError(getSafeErrorMessage(err, 'No se pudo reprogramar la cita.'));
      setSelectedSlot(null);
      if (err instanceof ApiError && err.status === 409) {
        await querySlots({ preserveSubmitError: true });
      }
    } finally {
      setSubmitBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="booking-dialog"
      aria-labelledby="client-reschedule-title"
      onCancel={(e) => {
        if (submitBusy) {
          e.preventDefault();
        } else {
          onClose();
        }
      }}
      onClose={() => {
        if (appointment) {
          onClose();
        }
      }}
    >
      <h2 id="client-reschedule-title">Reprogramar cita</h2>
      <form className="booking-dialog__form" noValidate onSubmit={handleSubmit}>
        <p className="panel-status">
          {appointment
            ? `${serviceName} · Profesional: ${
                appointment.professionalName || 'Profesional no disponible'
              } · Horario actual: ${formatLocalDate(
                appointment.startAt
              )} ${formatLocalTime(appointment.startAt)}`
            : ''}
        </p>

        <div className="form-field">
          <label htmlFor="client-reschedule-date">Nueva fecha *</label>
          <input
            ref={dateInputRef}
            id="client-reschedule-date"
            type="date"
            required
            disabled={submitBusy}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setSelectedSlot(null);
              setSlots([]);
              setHasQueried(false);
              setAvailStatus('');
              setAvailError('');
              setSubmitError('');
            }}
          />
        </div>

        <button
          type="button"
          className="button button--primary"
          disabled={submitBusy || availabilityBusy || !date}
          onClick={() => querySlots()}
        >
          Consultar horarios
        </button>

        <p className="panel-status" aria-live="polite">
          {availStatus}
        </p>
        <p className="panel-error" role="alert">
          {availError}
        </p>

        {hasQueried && slots.length > 0 && (
          <div
            className="booking-slots"
            role="radiogroup"
            aria-label="Horarios disponibles para reprogramar"
          >
            {slots.map((slot) => {
              const isSelected = selectedSlot?.startAt === slot.startAt;
              return (
                <label
                  key={slot.startAt}
                  className={
                    isSelected ? 'booking-slot booking-slot--selected' : 'booking-slot'
                  }
                >
                  <input
                    type="radio"
                    name="reschedule-slot"
                    value={slot.startAt}
                    checked={isSelected}
                    disabled={submitBusy || availabilityBusy}
                    onChange={() => {
                      setSelectedSlot(slot);
                      setSubmitError('');
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

        <p className="panel-error" role="alert">
          {submitError}
        </p>

        <div className="booking-dialog__actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={submitBusy || availabilityBusy || !selectedSlot}
          >
            {submitBusy ? 'Reprogramando...' : 'Confirmar reprogramación'}
          </button>
          <button
            type="button"
            className="button button--ghost"
            disabled={submitBusy}
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </form>
    </dialog>
  );
}
