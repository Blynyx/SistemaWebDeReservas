import { StatusBadge } from './StatusBadge.jsx';
import { formatLocalDate, formatLocalTime } from '../utils/dateTime.js';
import { formatPriceMinorUnits } from '../utils/money.js';

const ACTIVE_STATUSES = new Set(['PROGRAMADA', 'CONFIRMADA']);

export function AppointmentCard({
  appointment,
  serviceName,
  busy = false,
  onReschedule,
  onCancel,
}) {
  const canModify = ACTIVE_STATUSES.has(appointment.status);

  return (
    <article className="client-appointment-card">
      <div className="client-appointment-card__top">
        <h2 className="client-appointment-card__title">{serviceName}</h2>
        <StatusBadge status={appointment.status} />
      </div>

      <dl className="client-appointment-card__details">
        <div>
          <dt>Fecha</dt>
          <dd>{formatLocalDate(appointment.startAt)}</dd>
        </div>
        <div>
          <dt>Horario</dt>
          <dd>
            {formatLocalTime(appointment.startAt)} – {formatLocalTime(appointment.endAt)}
          </dd>
        </div>
        <div>
          <dt>Duración</dt>
          <dd>{appointment.serviceDurationMinutes} min</dd>
        </div>
        <div>
          <dt>Precio</dt>
          <dd>{formatPriceMinorUnits(appointment.servicePriceMinorUnits)}</dd>
        </div>
        <div>
          <dt>Profesional</dt>
          <dd>{appointment.professionalName || 'Profesional no disponible'}</dd>
        </div>
      </dl>

      {canModify && (
        <div className="client-appointment-card__actions">
          <button
            type="button"
            className="button button--ghost"
            disabled={busy}
            onClick={() => onReschedule(appointment)}
          >
            Reprogramar
          </button>
          <button
            type="button"
            className="button button--danger"
            disabled={busy}
            onClick={() => onCancel(appointment)}
          >
            Cancelar
          </button>
        </div>
      )}
    </article>
  );
}
