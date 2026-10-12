export const STATUS_LABELS = {
  PROGRAMADA: 'Programada',
  CONFIRMADA: 'Confirmada',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
  NO_ASISTIO: 'No asistió',
};

export function getStatusLabel(status) {
  return STATUS_LABELS[status] ?? status;
}

export function createStatusBadge(status) {
  const badge = document.createElement('span');
  badge.className = `status-badge status-badge--${status}`;
  badge.textContent = getStatusLabel(status);
  return badge;
}

export function getAppointmentActions(status) {
  if (status === 'PROGRAMADA') {
    return ['confirm', 'reschedule', 'cancel', 'complete', 'noShow'];
  }

  if (status === 'CONFIRMADA') {
    return ['reschedule', 'cancel', 'complete', 'noShow'];
  }

  return [];
}
