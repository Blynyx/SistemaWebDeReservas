import { getDb } from '../../database/connection.js';

const APPOINTMENT_COLUMNS = `
  id,
  organization_id,
  client_id,
  professional_id,
  service_id,
  start_at,
  end_at,
  service_duration_minutes,
  service_price_minor_units,
  status,
  created_at,
  updated_at
`;

export function insertAppointment({
  id,
  organizationId,
  clientId,
  professionalId,
  serviceId,
  startAt,
  endAt,
  serviceDurationMinutes,
  servicePriceMinorUnits,
}) {
  getDb()
    .prepare(
      `
        INSERT INTO appointments (
          id,
          organization_id,
          client_id,
          professional_id,
          service_id,
          start_at,
          end_at,
          service_duration_minutes,
          service_price_minor_units,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PROGRAMADA')
      `
    )
    .run(
      id,
      organizationId,
      clientId,
      professionalId,
      serviceId,
      startAt,
      endAt,
      serviceDurationMinutes,
      servicePriceMinorUnits
    );
}

export function findById(organizationId, appointmentId) {
  return getDb()
    .prepare(
      `
        SELECT ${APPOINTMENT_COLUMNS}
        FROM appointments
        WHERE organization_id = ? AND id = ?
      `
    )
    .get(organizationId, appointmentId);
}

export function findAllByOrganization(organizationId) {
  return getDb()
    .prepare(
      `
        SELECT ${APPOINTMENT_COLUMNS}
        FROM appointments
        WHERE organization_id = ?
        ORDER BY start_at
      `
    )
    .all(organizationId);
}

export function findActiveByProfessionalInRange(
  organizationId,
  professionalId,
  rangeStart,
  rangeEnd
) {
  return getDb()
    .prepare(
      `
        SELECT ${APPOINTMENT_COLUMNS}
        FROM appointments
        WHERE organization_id = ?
          AND professional_id = ?
          AND status IN ('PROGRAMADA', 'CONFIRMADA')
          AND start_at < ?
          AND end_at > ?
        ORDER BY start_at
      `
    )
    .all(organizationId, professionalId, rangeEnd, rangeStart);
}

export function hasActiveOverlap({
  organizationId,
  professionalId,
  startAt,
  endAt,
  excludeAppointmentId = null,
}) {
  const row = getDb()
    .prepare(
      `
        SELECT 1 AS found
        FROM appointments
        WHERE organization_id = ?
          AND professional_id = ?
          AND status IN ('PROGRAMADA', 'CONFIRMADA')
          AND start_at < ?
          AND end_at > ?
          AND (? IS NULL OR id != ?)
      `
    )
    .get(
      organizationId,
      professionalId,
      endAt,
      startAt,
      excludeAppointmentId,
      excludeAppointmentId
    );

  return Boolean(row);
}

export function updateStatus(organizationId, appointmentId, status) {
  getDb()
    .prepare(
      `
        UPDATE appointments
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE organization_id = ? AND id = ?
      `
    )
    .run(status, organizationId, appointmentId);
}

export function reschedule(organizationId, appointmentId, { startAt, endAt }) {
  getDb()
    .prepare(
      `
        UPDATE appointments
        SET start_at = ?,
            end_at = ?,
            status = 'PROGRAMADA',
            updated_at = CURRENT_TIMESTAMP
        WHERE organization_id = ? AND id = ?
      `
    )
    .run(startAt, endAt, organizationId, appointmentId);
}
