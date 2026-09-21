import { getDb } from '../../database/connection.js';

const SERVICE_COLUMNS = `
  id,
  organization_id,
  name,
  description,
  duration_minutes,
  price_minor_units,
  is_active,
  created_at,
  updated_at
`;

export function insertService({
  id,
  organizationId,
  name,
  description,
  durationMinutes,
  priceMinorUnits,
}) {
  getDb()
    .prepare(
      `
        INSERT INTO services (
          id,
          organization_id,
          name,
          description,
          duration_minutes,
          price_minor_units
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .run(id, organizationId, name, description, durationMinutes, priceMinorUnits);
}

export function findById(organizationId, serviceId) {
  return getDb()
    .prepare(
      `
        SELECT ${SERVICE_COLUMNS}
        FROM services
        WHERE organization_id = ? AND id = ?
      `
    )
    .get(organizationId, serviceId);
}

export function findAllByOrganization(organizationId) {
  return getDb()
    .prepare(
      `
        SELECT ${SERVICE_COLUMNS}
        FROM services
        WHERE organization_id = ?
        ORDER BY name
      `
    )
    .all(organizationId);
}

export function updateService(organizationId, serviceId, fields) {
  const assignments = [];
  const values = [];

  if (fields.name !== undefined) {
    assignments.push('name = ?');
    values.push(fields.name);
  }

  if (fields.description !== undefined) {
    assignments.push('description = ?');
    values.push(fields.description);
  }

  if (fields.durationMinutes !== undefined) {
    assignments.push('duration_minutes = ?');
    values.push(fields.durationMinutes);
  }

  if (fields.priceMinorUnits !== undefined) {
    assignments.push('price_minor_units = ?');
    values.push(fields.priceMinorUnits);
  }

  assignments.push('updated_at = ?');
  values.push(fields.updatedAt);
  values.push(organizationId, serviceId);

  getDb()
    .prepare(
      `
        UPDATE services
        SET ${assignments.join(', ')}
        WHERE organization_id = ? AND id = ?
      `
    )
    .run(...values);
}

export function deactivateService(organizationId, serviceId, updatedAt) {
  getDb()
    .prepare(
      `
        UPDATE services
        SET is_active = 0, updated_at = ?
        WHERE organization_id = ? AND id = ?
      `
    )
    .run(updatedAt, organizationId, serviceId);
}
