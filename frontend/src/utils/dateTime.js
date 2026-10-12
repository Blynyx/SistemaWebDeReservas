const DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatLocalDate(value) {
  const datePart = typeof value === 'string' ? value.slice(0, 10) : '';
  const match = DATE_PATTERN.exec(datePart);

  if (!match) {
    return value ?? '';
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function formatLocalTime(value) {
  const match = DATETIME_PATTERN.exec(value);
  return match ? `${match[4]}:${match[5]}` : '';
}

export function isDateTimeLocal(value) {
  return DATETIME_PATTERN.test(value);
}
