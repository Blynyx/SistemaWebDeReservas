import { listMyNotifications, updateMyNotificationReadState } from './notification.service.js';

export function listMyNotificationsController(req, res, next) {
  try {
    const result = listMyNotifications(req.user.organizationId, req.user.id, req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export function updateMyNotificationReadStateController(req, res, next) {
  try {
    const result = updateMyNotificationReadState(
      req.user.organizationId,
      req.user.id,
      req.params.id,
      req.body
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
