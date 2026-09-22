import { getDb } from '../../database/connection.js';

const PROFESSIONAL_COLUMNS = `
  id,
  organization_id,
  user_account_id,
  name,
  email,
  phone,
  is_active,
  created_at,
  updated_at
`;

export function insertProfessional({
  id,
  organizationId,
  name,
  email,
  phone,
}) {
  getDb()
    .prepare(
      `
        INSERT INTO professionals (
          id,
          organization_id,
          user_account_id,
          name,
          email,
          phone
        )
        VALUES (?, ?, NULL, ?, ?, ?)
      `
    )
    .run(id, organizationId, name, email, phone);
}

export function findById(organizationId, professionalId) {
  return getDb()
    .prepare(
      `
        SELECT ${PROFESSIONAL_COLUMNS}
        FROM professionals
        WHERE organization_id = ? AND id = ?
      `
    )
    .get(organizationId, professionalId);
}

export function findAllByOrganization(organizationId) {
  return getDb()
    .prepare(
      `
        SELECT ${PROFESSIONAL_COLUMNS}
        FROM professionals
        WHERE organization_id = ?
        ORDER BY name
      `
    )
    .all(organizationId);
}

export function updateProfessional(organizationId, professionalId, fields) {
  const assignments = [];
  const values = [];

  if (fields.name !== undefined) {
    assignments.push('name = ?');
    values.push(fields.name);
  }

  if (fields.email !== undefined) {
    assignments.push('email = ?');
    values.push(fields.email);
  }

  if (fields.phone !== undefined) {
    assignments.push('phone = ?');
    values.push(fields.phone);
  }

  assignments.push('updated_at = ?');
  values.push(fields.updatedAt);
  values.push(organizationId, professionalId);

  getDb()
    .prepare(
      `
        UPDATE professionals
        SET ${assignments.join(', ')}
        WHERE organization_id = ? AND id = ?
      `
    )
    .run(...values);
}

export function findByUserAccountId(organizationId, userAccountId) {
  return getDb()
    .prepare(
      `
        SELECT ${PROFESSIONAL_COLUMNS}
        FROM professionals
        WHERE organization_id = ? AND user_account_id = ?
      `
    )
    .get(organizationId, userAccountId);
}

export function linkUserAccount(organizationId, professionalId, userAccountId, updatedAt) {
  getDb()
    .prepare(
      `
        UPDATE professionals
        SET user_account_id = ?, updated_at = ?
        WHERE organization_id = ? AND id = ? AND user_account_id IS NULL
      `
    )
    .run(userAccountId, updatedAt, organizationId, professionalId);
}

export function deactivateProfessional(organizationId, professionalId, updatedAt) {
  getDb()
    .prepare(
      `
        UPDATE professionals
        SET is_active = 0, updated_at = ?
        WHERE organization_id = ? AND id = ?
      `
    )
    .run(updatedAt, organizationId, professionalId);
}
