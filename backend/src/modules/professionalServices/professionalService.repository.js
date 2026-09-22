import { getDb } from '../../database/connection.js';

export function insertAssignment({ organizationId, professionalId, serviceId }) {
  getDb()
    .prepare(
      `
        INSERT INTO professional_services (
          organization_id,
          professional_id,
          service_id
        )
        VALUES (?, ?, ?)
      `
    )
    .run(organizationId, professionalId, serviceId);
}

export function findAssignment(organizationId, professionalId, serviceId) {
  return getDb()
    .prepare(
      `
        SELECT organization_id, professional_id, service_id, created_at
        FROM professional_services
        WHERE organization_id = ? AND professional_id = ? AND service_id = ?
      `
    )
    .get(organizationId, professionalId, serviceId);
}

export function assignmentExists(organizationId, professionalId, serviceId) {
  return Boolean(findAssignment(organizationId, professionalId, serviceId));
}

export function findProfessionalsByService(organizationId, serviceId) {
  return getDb()
    .prepare(
      `
        SELECT
          p.id,
          p.organization_id,
          p.name,
          p.email,
          p.phone,
          p.is_active
        FROM professional_services AS ps
        INNER JOIN professionals AS p
          ON p.organization_id = ps.organization_id
         AND p.id = ps.professional_id
        WHERE ps.organization_id = ?
          AND ps.service_id = ?
        ORDER BY p.name
      `
    )
    .all(organizationId, serviceId);
}

export function findServicesByProfessional(organizationId, professionalId) {
  return getDb()
    .prepare(
      `
        SELECT
          s.id,
          s.name,
          s.description,
          s.duration_minutes,
          s.price_minor_units,
          s.is_active
        FROM professional_services AS ps
        INNER JOIN services AS s
          ON s.organization_id = ps.organization_id
         AND s.id = ps.service_id
        WHERE ps.organization_id = ?
          AND ps.professional_id = ?
        ORDER BY s.name
      `
    )
    .all(organizationId, professionalId);
}

export function removeAssignment(organizationId, professionalId, serviceId) {
  getDb()
    .prepare(
      `
        DELETE FROM professional_services
        WHERE organization_id = ? AND professional_id = ? AND service_id = ?
      `
    )
    .run(organizationId, professionalId, serviceId);
}
