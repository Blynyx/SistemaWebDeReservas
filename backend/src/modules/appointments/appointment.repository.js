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

export function hasActiveOverlap(organizationId, professionalId, startAt, endAt) {
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
      `
    )
    .get(organizationId, professionalId, endAt, startAt);

  return Boolean(row);
}
