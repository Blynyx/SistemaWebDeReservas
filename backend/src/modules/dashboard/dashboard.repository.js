import { getDb } from '../../database/connection.js';

export function countAppointmentsByStatusInRange(organizationId, rangeStart, rangeEnd) {
  return getDb()
    .prepare(
      `
        SELECT status, COUNT(*) AS total
        FROM appointments
        WHERE organization_id = ?
          AND start_at < ?
          AND end_at > ?
        GROUP BY status
      `
    )
    .all(organizationId, rangeEnd, rangeStart);
}

export function countActiveClients(organizationId) {
  return getDb()
    .prepare(
      `
        SELECT COUNT(*) AS total
        FROM clients
        WHERE organization_id = ?
          AND is_active = 1
      `
    )
    .get(organizationId).total;
}

export function countActiveProfessionals(organizationId) {
  return getDb()
    .prepare(
      `
        SELECT COUNT(*) AS total
        FROM professionals
        WHERE organization_id = ?
          AND is_active = 1
      `
    )
    .get(organizationId).total;
}

export function countActiveServices(organizationId) {
  return getDb()
    .prepare(
      `
        SELECT COUNT(*) AS total
        FROM services
        WHERE organization_id = ?
          AND is_active = 1
      `
    )
    .get(organizationId).total;
}
