import dayjs from 'dayjs';

const DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function getTodayLocalDate() {
  return dayjs().format('YYYY-MM-DD');
}

export function formatLocalDate(value) {
  const datePart = typeof value === 'string' ? value.slice(0, 10) : '';
  if (!DATE_PATTERN.test(datePart)) {
    return value ?? '';
  }

  const parsed = dayjs(datePart);
  return parsed.isValid() ? parsed.format('DD/MM/YYYY') : value ?? '';
}

export function formatLocalTime(value) {
  if (typeof value !== 'string' || !DATETIME_PATTERN.test(value)) {
    return '';
  }

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('HH:mm') : value.slice(11, 16);
}

export function formatIsoTimestamp(isoString) {
  if (typeof isoString !== 'string' || !isoString) {
    return '';
  }

  const localPart = isoString.slice(0, 16);
  if (DATETIME_PATTERN.test(localPart)) {
    return `${formatLocalDate(localPart)} ${formatLocalTime(localPart)}`;
  }

  const parsed = dayjs(isoString);
  return parsed.isValid() ? parsed.format('DD/MM/YYYY HH:mm') : isoString;
}

export function isDateTimeLocal(value) {
  return typeof value === 'string' && DATETIME_PATTERN.test(value);
}
