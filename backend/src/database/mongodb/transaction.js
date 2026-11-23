import { getMongoClient } from './client.js';
import { isProfessionalDayLockDuplicateKeyError } from './errors.js';

export const DEFAULT_TRANSACTION_OPTIONS = {
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
  readPreference: 'primary',
};

export const DEFAULT_DAY_LOCK_MAX_ATTEMPTS = 5;

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

/**
 * Ejecuta una transacción con retry acotado externo únicamente cuando ocurre
 * E11000 sobre el índice único de `professionalDayLocks` durante el upsert
 * concurrente inicial. Cualquier otro E11000 o error de negocio se propaga
 * sin reintento.
 */
export async function withDayLockTransaction(
  callback,
  {
    client = getMongoClient(),
    transactionOptions = {},
    maxAttempts = DEFAULT_DAY_LOCK_MAX_ATTEMPTS,
  } = {}
) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError('maxAttempts debe ser un entero positivo');
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await withTransaction(callback, { client, transactionOptions });
    } catch (error) {
      if (isProfessionalDayLockDuplicateKeyError(error) && attempt < maxAttempts) {
        continue;
      }
      throw error;
    }
  }
}
