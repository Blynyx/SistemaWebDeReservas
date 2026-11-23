import { MongoServerError } from 'mongodb';

export const PROFESSIONAL_DAY_LOCK_INDEX_NAME = 'ux_professional_day_locks_org_prof_date';

export function isMongoServerError(error) {
  return error instanceof MongoServerError || error?.name === 'MongoServerError';
}

export function isDuplicateKeyError(error) {
  return error?.code === 11000 || error?.codeName === 'DuplicateKey';
}

export function getDuplicateKeyIndexName(error) {
  if (!isDuplicateKeyError(error)) {
    return null;
  }

  const message = typeof error?.message === 'string' ? error.message : '';
  const match = message.match(/index:\s+([^\s]+)/);
  return match ? match[1] : null;
}

export function isProfessionalDayLockDuplicateKeyError(error) {
  if (!isDuplicateKeyError(error)) {
    return false;
  }

  const indexName = getDuplicateKeyIndexName(error);
  if (indexName === PROFESSIONAL_DAY_LOCK_INDEX_NAME) {
    return true;
  }

  const keyPattern = error?.keyPattern;
  const message = typeof error?.message === 'string' ? error.message : '';
  return Boolean(
    keyPattern &&
      keyPattern.organizationId === 1 &&
      keyPattern.professionalId === 1 &&
      keyPattern.date === 1 &&
      message.includes('professionalDayLocks')
  );
}

export function hasTransientTransactionLabel(error) {
  if (!error || typeof error.hasErrorLabel !== 'function') {
    return false;
  }

  return (
    error.hasErrorLabel('TransientTransactionError') ||
    error.hasErrorLabel('UnknownTransactionCommitResult')
  );
}

export function classifyMongoError(error) {
  return {
    isMongoServerError: isMongoServerError(error),
    isDuplicateKey: isDuplicateKeyError(error),
    duplicateKeyIndex: getDuplicateKeyIndexName(error),
    isProfessionalDayLockDuplicate: isProfessionalDayLockDuplicateKeyError(error),
    isTransientTransaction: hasTransientTransactionLabel(error),
    cause: error,
  };
}
