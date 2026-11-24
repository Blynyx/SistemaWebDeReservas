import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { getMyNotifications, setNotificationReadState } from '../api/notifications.api.js';
import { NotificationList } from '../components/NotificationList.jsx';
import { getSafeErrorMessage } from '../utils/apiMessages.js';

const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'unread', label: 'No leídas' },
  { key: 'read', label: 'Leídas' },
];

const COPY_BY_ROLE = {
  CLIENT: 'Avisos generados automáticamente sobre el estado de tus citas.',
  PROFESSIONAL:
    'Avisos generados automáticamente sobre las citas asignadas a tu agenda.',
};

export function NotificationsPage() {
  const { session } = useAuth();
  const leadText = COPY_BY_ROLE[session?.user?.role] ?? COPY_BY_ROLE.CLIENT;
  const [currentFilter, setCurrentFilter] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busyId, setBusyId] = useState(null);

  const requestIdRef = useRef(0);

  const loadNotifications = useCallback(async (filter, { keepFeedback = false } = {}) => {
    const currentReq = ++requestIdRef.current;
    setLoading(true);
    setError('');
    if (!keepFeedback) {
      setFeedback('');
    }

    try {
      const payload = await getMyNotifications(filter);
      if (currentReq !== requestIdRef.current) {
        return;
      }
      setNotifications(payload?.notifications ?? []);
      setUnreadCount(payload?.unreadCount ?? 0);
    } catch (err) {
      if (currentReq !== requestIdRef.current) {
        return;
      }
      setError(getSafeErrorMessage(err, 'No se pudieron cargar las notificaciones.'));
    } finally {
      if (currentReq === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadNotifications(currentFilter);
  }, [currentFilter, loadNotifications]);

  async function handleToggleRead(notification) {
    setBusyId(notification.id);
    setError('');
    setFeedback('');
    const targetState = !notification.isRead;

    try {
      await setNotificationReadState(notification.id, targetState);
      setFeedback(
        targetState
          ? 'Notificación marcada como leída.'
          : 'Notificación marcada como no leída.'
      );
      await loadNotifications(currentFilter, { keepFeedback: true });
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo actualizar la notificación.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="staff-page client-portal">
      <div className="client-portal__header">
        <div>
          <h1>Notificaciones</h1>
          <p className="staff-page__lead">{leadText}</p>
        </div>
        <span className="client-unread-badge" aria-live="polite">
          No leídas: {unreadCount}
        </span>
      </div>

      <div
        className="client-filter-bar"
        role="group"
        aria-label="Filtrar notificaciones"
      >
        {FILTERS.map((item) => {
          const active = item.key === currentFilter;
          return (
            <button
              key={item.key}
              type="button"
              className={active ? 'button button--primary' : 'button button--ghost'}
              aria-pressed={String(active)}
              onClick={() => {
                if (currentFilter !== item.key) {
                  setCurrentFilter(item.key);
                }
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <p className="panel-feedback" aria-live="polite">
        {feedback}
      </p>
      <p className="panel-error" role="alert">
        {error}
      </p>

      <div className="client-notifications-results">
        {loading ? (
          <p className="panel-status">Cargando notificaciones...</p>
        ) : (
          <NotificationList
            notifications={notifications}
            busyId={busyId}
            onToggleRead={handleToggleRead}
          />
        )}
      </div>
    </section>
  );
}
