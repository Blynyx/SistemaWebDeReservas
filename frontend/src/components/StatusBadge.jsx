import { getStatusLabel } from '../utils/appointmentStatus.js';

export function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      {getStatusLabel(status)}
    </span>
  );
}
