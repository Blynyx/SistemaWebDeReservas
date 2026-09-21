import { getDb } from '../../database/connection.js';

export function insertUserAccount({
  id,
  organizationId,
  email,
  passwordHash,
  role,
  isActive,
}) {
  getDb()
    .prepare(
      `
        INSERT INTO user_accounts (
          id,
          organization_id,
          email,
          password_hash,
          role,
          is_active
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .run(id, organizationId, email, passwordHash, role, isActive);
}

export function findById(id) {
  return getDb()
    .prepare(
      `
        SELECT id, organization_id, email, role, is_active
        FROM user_accounts
        WHERE id = ?
      `
    )
    .get(id);
}
