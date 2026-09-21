import { getDb } from './connection.js';

export function runInTransaction(callback) {
  const db = getDb();
  return db.transaction(callback)();
}
