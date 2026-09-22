const DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d$/;

export function parseLocalDateTime(value) {
  if (typeof value !== 'string' || !DATETIME_PATTERN.test(value)) {
    return null;
  }

  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day ||
    parsed.getUTCHours() !== hour ||
    parsed.getUTCMinutes() !== minute
  ) {
    return null;
  }

  return { year, month, day, hour, minute, value };
}

function pad(value) {
  return String(value).padStart(2, '0');
}

export function formatLocalDateTime(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function addMinutes(startAt, minutes) {
  const parts = parseLocalDateTime(startAt);

  if (!parts) {
    return null;
  }

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute));
  date.setUTCMinutes(date.getUTCMinutes() + minutes);

  return formatLocalDateTime(date);
}

export function getDayOfWeek(startAt) {
  const parts = parseLocalDateTime(startAt);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute));
  const utcDay = date.getUTCDay();

  return utcDay === 0 ? 7 : utcDay;
}

export function getDatePart(dateTime) {
  return dateTime.slice(0, 10);
}

export function getTimePart(dateTime) {
  return dateTime.slice(11, 16);
}

// En esta etapa se asume que el servidor opera en la misma zona
// horaria operativa que la organización. No usar toISOString().
export function nowLocalDateTime() {
  const now = new Date();

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
