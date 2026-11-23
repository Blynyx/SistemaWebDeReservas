import { getMongoClient } from './client.js';

export const DEFAULT_TRANSACTION_OPTIONS = {
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
  readPreference: 'primary',
};

/**
 * Ejecuta una callback dentro de una transacción multi-documento MongoDB.
 *
 * IMPORTANTE: `session.withTransaction(...)` puede re-ejecutar `callback` ante
 * errores transitorios del Replica Set (`TransientTransactionError`).
 * Por lo tanto, `callback` debe ser segura frente a reintentos (idempotente) y
 * NO debe ejecutar efectos externos irreversibles (emails, APIs externas, archivos).
 * Todas las operaciones MongoDB relacionadas deben recibir `{ session }`.
 */
export async function withTransaction(
  callback,
  { client = getMongoClient(), transactionOptions = {} } = {}
) {
  if (typeof callback !== 'function') {
    throw new TypeError('withTransaction requiere una función callback');
  }

  const session = client.startSession();
  const options = { ...DEFAULT_TRANSACTION_OPTIONS, ...transactionOptions };

  try {
    return await session.withTransaction(async () => callback(session), options);
  } finally {
    await session.endSession();
  }
}
