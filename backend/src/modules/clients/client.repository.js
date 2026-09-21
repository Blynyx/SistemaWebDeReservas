import { getDb } from '../../database/connection.js';

const CLIENT_COLUMNS = `
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

export function insertClient({
  id,
  organizationId,
  name,
  email,
  phone,
}) {
  getDb()
    .prepare(
      `
        INSERT INTO clients (
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

export function findById(organizationId, clientId) {
  return getDb()
    .prepare(
      `
        SELECT ${CLIENT_COLUMNS}
        FROM clients
        WHERE organization_id = ? AND id = ?
      `
    )
    .get(organizationId, clientId);
}

export function findAllByOrganization(organizationId) {
  return getDb()
    .prepare(
      `
        SELECT ${CLIENT_COLUMNS}
        FROM clients
        WHERE organization_id = ?
        ORDER BY name
      `
    )
    .all(organizationId);
}

export function updateClient(organizationId, clientId, fields) {
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
  values.push(organizationId, clientId);

  getDb()
    .prepare(
      `
        UPDATE clients
        SET ${assignments.join(', ')}
        WHERE organization_id = ? AND id = ?
      `
    )
    .run(...values);
}

export function deactivateClient(organizationId, clientId, updatedAt) {
  getDb()
    .prepare(
      `
        UPDATE clients
        SET is_active = 0, updated_at = ?
        WHERE organization_id = ? AND id = ?
      `
    )
    .run(updatedAt, organizationId, clientId);
}
