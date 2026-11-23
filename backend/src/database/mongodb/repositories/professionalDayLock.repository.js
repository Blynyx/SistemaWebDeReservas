import { getMongoDb } from '../client.js';
import { requireOrganizationId } from './mappers.js';

const COLLECTION = 'professionalDayLocks';
const LOCAL_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function collection() {
  return getMongoDb().collection(COLLECTION);
}

/**
 * Extrae la fecha local YYYY-MM-DD de forma determinista sin convertir a UTC.
 */
export function extractLockDate(startAt) {
  if (typeof startAt !== 'string' || !LOCAL_DATETIME_PATTERN.test(startAt)) {
    throw new Error('startAt debe tener el formato local YYYY-MM-DDTHH:mm');
  }
  return startAt.slice(0, 10);
}

/**
 * Adquiere un lock de escritura sobre el documento (organizationId, professionalId, date)
 * dentro de una transacción activa para serializar reservas competidoras.
 */
export async function acquireProfessionalDayLock(
  { organizationId, professionalId, date },
  { session } = {}
) {
  if (!session) {
    throw new Error('ClientSession es obligatoria para adquirir professionalDayLock');
  }

  requireOrganizationId(organizationId);

  if (typeof professionalId !== 'string' || professionalId.trim() === '') {
    throw new Error('professionalId es obligatorio para adquirir professionalDayLock');
  }

  if (typeof date !== 'string' || !LOCAL_DATE_PATTERN.test(date)) {
    throw new Error('date debe tener el formato YYYY-MM-DD para adquirir professionalDayLock');
  }

  const now = new Date().toISOString();
  return collection().findOneAndUpdate(
    { organizationId, professionalId, date },
    {
      $inc: { seq: 1 },
      $set: { updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    {
      upsert: true,
      returnDocument: 'after',
      projection: { _id: 0 },
      session,
    }
  );
}
