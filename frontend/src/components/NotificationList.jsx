import { formatIsoTimestamp } from '../utils/dateTime.js';

export function NotificationList({ notifications, busyId, onToggleRead }) {
  if (notifications.length === 0) {
    return <p className="panel-status">No hay notificaciones para mostrar.</p>;
  }

  return (
    <ul className="client-notifications-list">
      {notifications.map((notification) => {
        const isBusy = busyId === notification.id;
        return (
          <li
            key={notification.id}
            className={
              notification.isRead
                ? 'client-notification-item client-notification-item--read'
                : 'client-notification-item client-notification-item--unread'
            }
          >
            <div className="client-notification-item__top">
              <h2 className="client-notification-item__title">{notification.title}</h2>
              <span
                className={
                  notification.isRead
                    ? 'client-notification-tag client-notification-tag--read'
                    : 'client-notification-tag client-notification-tag--unread'
                }
              >
                {notification.isRead ? 'Leída' : 'No leída'}
              </span>
            </div>
            <p className="client-notification-item__message">{notification.message}</p>
            <div className="client-notification-item__footer">
              <span className="client-notification-item__date">
                {formatIsoTimestamp(notification.createdAt)}
              </span>
              <button
                type="button"
                className="button button--ghost"
                disabled={isBusy}
                onClick={() => onToggleRead(notification)}
              >
                {notification.isRead ? 'Marcar como no leída' : 'Marcar como leída'}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
