import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import {
  completeMyProfessionalAppointment,
  markMyProfessionalAppointmentNoShow,
} from '../api/self.api.js';
import { getSafeErrorMessage } from '../utils/apiMessages.js';
import { formatLocalDate, formatLocalTime } from '../utils/dateTime.js';
import { StatusBadge } from './StatusBadge.jsx';

const ACTIVE_STATUSES = new Set(['PROGRAMADA', 'CONFIRMADA']);

export function hasAppointmentEnded(appointment) {
  // Presentación únicamente; el backend es la autoridad final (409).
  return !dayjs(appointment.endAt).isAfter(dayjs());
}

export function ProfessionalAppointmentDialog({ appointment, serviceName, onClose, onChanged }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const [busyAction, setBusyAction] = useState(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [current, setCurrent] = useState(appointment);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (appointment) {
      setCurrent(appointment);
      setBusyAction(null);
      setError('');
      setFeedback('');
      if (!dialog.open) {
        dialog.showModal();
      }
      closeRef.current?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [appointment]);

  const isActive = current ? ACTIVE_STATUSES.has(current.status) : false;
  const ended = current ? hasAppointmentEnded(current) : false;
  const canAct = isActive && ended;

  async function runAction(action) {
    if (!current || busyAction) {
      return;
    }

    setBusyAction(action);
    setError('');
    setFeedback('');

    try {
      const updated =
        action === 'complete'
          ? await completeMyProfessionalAppointment(current.id)
          : await markMyProfessionalAppointmentNoShow(current.id);

      setCurrent((prev) => ({ ...prev, ...updated }));
      setFeedback(
        action === 'complete'
          ? 'Cita marcada como completada.'
          : 'Cita marcada como no asistió.'
      );
      await onChanged?.(updated);
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo actualizar la cita.'));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="booking-dialog pro-appointment-dialog"
      aria-labelledby="pro-appointment-title"
      onCancel={(e) => {
        if (busyAction) {
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
      <h2 id="pro-appointment-title">Detalle de la cita</h2>

      {current && (
        <>
          <dl className="pro-appointment-dialog__details">
            <div>
              <dt>Servicio</dt>
              <dd>{serviceName}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd>{formatLocalDate(current.startAt)}</dd>
            </div>
            <div>
              <dt>Inicio</dt>
              <dd>{formatLocalTime(current.startAt)}</dd>
            </div>
            <div>
              <dt>Fin</dt>
              <dd>{formatLocalTime(current.endAt)}</dd>
            </div>
            <div>
              <dt>Duración</dt>
              <dd>{current.serviceDurationMinutes} min</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>
                <StatusBadge status={current.status} />
              </dd>
            </div>
            <div>
              <dt>Cliente</dt>
              <dd>{current.clientName || 'Cliente no disponible'}</dd>
            </div>
          </dl>

          {isActive && !ended && (
            <p className="panel-status">Disponible al finalizar la cita</p>
          )}

          {canAct && (
            <div className="pro-appointment-dialog__actions">
              <button
                type="button"
                className="button button--primary"
                disabled={Boolean(busyAction)}
                onClick={() => runAction('complete')}
              >
                {busyAction === 'complete' ? 'Guardando...' : 'Marcar completada'}
              </button>
              <button
                type="button"
                className="button button--ghost"
                disabled={Boolean(busyAction)}
                onClick={() => runAction('no-show')}
              >
                {busyAction === 'no-show' ? 'Guardando...' : 'Marcar no asistió'}
              </button>
            </div>
          )}
        </>
      )}

      <p className="panel-feedback" aria-live="polite">
        {feedback}
      </p>
      <p className="panel-error" role="alert">
        {error}
      </p>

      <div className="booking-dialog__actions">
        <button
          ref={closeRef}
          type="button"
          className="button button--ghost"
          disabled={Boolean(busyAction)}
          onClick={onClose}
        >
          Cerrar
        </button>
      </div>
    </dialog>
  );
}
