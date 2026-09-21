import { getDb } from '../../database/connection.js';

export function slugExists(slug) {
  const row = getDb()
    .prepare('SELECT 1 AS found FROM organizations WHERE slug = ?')
    .get(slug);

  return Boolean(row);
}

export function insertOrganization({ id, name, slug }) {
  getDb()
    .prepare(
      `
        INSERT INTO organizations (id, name, slug)
        VALUES (?, ?, ?)
      `
    )
    .run(id, name, slug);
}

export function findById(id) {
  return getDb()
    .prepare(
      `
        SELECT id, name, slug, is_active
        FROM organizations
        WHERE id = ?
      `
    )
    .get(id);
}
