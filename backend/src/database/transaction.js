import { getDb } from './connection.js';

export function runInTransaction(callback) {
  const db = getDb();
  return db.transaction(callback)();
}

// BEGIN IMMEDIATE toma el lock de escritura antes de revalidar e insertar,
// para que dos reservas del mismo hueco no pasen ambas la comprobación.
export function runInImmediateTransaction(callback) {
  const db = getDb();
  return db.transaction(callback).immediate();
}
