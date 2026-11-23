import { listMyNotifications, updateMyNotificationReadState } from './notification.service.js';

export async function listMyNotificationsController(req, res, next) {
  try {
    const result = await listMyNotifications(req.user.organizationId, req.user.id, req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateMyNotificationReadStateController(req, res, next) {
  try {
    const result = await updateMyNotificationReadState(
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
