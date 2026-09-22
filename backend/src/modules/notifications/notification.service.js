import { randomUUID } from 'node:crypto';
import { httpError } from '../../utils/httpError.js';
import { findById as findClientById } from '../clients/client.repository.js';
import { findById as findProfessionalById } from '../professionals/professional.repository.js';
import {
  countUnread,
  findByRecipient,
  findByRecipientAndId,
  insertNotification,
  setReadState,
} from './notification.repository.js';

// Las notificaciones informan al usuario. No son un historial
// autoritativo de Appointment y no deben usarse para cambiar citas.

function toNotificationResponse(row) {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    type: row.type,
    title: row.title,
    message: row.message,
    isRead: row.is_read === 1,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

function parseStatusFilter(status) {
  const value = status === undefined ? 'all' : status;

  if (value === 'all') {
    return {};
  }

  if (value === 'unread') {
    return { unreadOnly: true };
  }

  if (value === 'read') {
    return { readOnly: true };
  }

  throw httpError(400, 'status debe ser all, unread o read');
}

function parseIsRead(value) {
  if (typeof value !== 'boolean') {
    throw httpError(400, 'isRead es obligatorio y debe ser un boolean');
  }

  return value;
}

function notifyRecipient({
  organizationId,
  recipientUserAccountId,
  appointmentId,
  type,
  title,
  message,
}) {
  if (!recipientUserAccountId) {
    return;
  }

  insertNotification({
    id: randomUUID(),
    organizationId,
    recipientUserAccountId,
    appointmentId,
    type,
    title,
    message,
  });
}

export function createAppointmentEventNotifications({
  organizationId,
  appointment,
  eventType,
  previousStartAt = null,
}) {
  const client = findClientById(organizationId, appointment.client_id);
  const professional = findProfessionalById(organizationId, appointment.professional_id);
  const startAt = appointment.start_at;

  if (eventType === 'CREATED') {
    notifyRecipient({
      organizationId,
      recipientUserAccountId: client?.user_account_id,
      appointmentId: appointment.id,
      type: 'APPOINTMENT_CREATED',
      title: 'Reserva creada',
      message: `Tu cita del ${startAt} fue creada correctamente.`,
    });
    notifyRecipient({
      organizationId,
      recipientUserAccountId: professional?.user_account_id,
      appointmentId: appointment.id,
      type: 'APPOINTMENT_ASSIGNED',
      title: 'Nueva cita asignada',
      message: `Se te asignó una nueva cita para ${startAt}.`,
    });
    return;
  }

  if (eventType === 'CONFIRMED') {
    notifyRecipient({
      organizationId,
      recipientUserAccountId: client?.user_account_id,
      appointmentId: appointment.id,
      type: 'APPOINTMENT_CONFIRMED',
      title: 'Cita confirmada',
      message: `Tu cita del ${startAt} fue confirmada.`,
    });
    return;
  }

  if (eventType === 'RESCHEDULED') {
    notifyRecipient({
      organizationId,
      recipientUserAccountId: client?.user_account_id,
      appointmentId: appointment.id,
      type: 'APPOINTMENT_RESCHEDULED',
      title: 'Cita reprogramada',
      message: `Tu cita fue reprogramada de ${previousStartAt} a ${startAt}.`,
    });
    notifyRecipient({
      organizationId,
      recipientUserAccountId: professional?.user_account_id,
      appointmentId: appointment.id,
      type: 'APPOINTMENT_RESCHEDULED',
      title: 'Cita reprogramada',
      message: `Una cita asignada fue reprogramada de ${previousStartAt} a ${startAt}.`,
    });
    return;
  }

  if (eventType === 'CANCELLED') {
    notifyRecipient({
      organizationId,
      recipientUserAccountId: client?.user_account_id,
      appointmentId: appointment.id,
      type: 'APPOINTMENT_CANCELLED',
      title: 'Cita cancelada',
      message: `Tu cita del ${startAt} fue cancelada.`,
    });
    notifyRecipient({
      organizationId,
      recipientUserAccountId: professional?.user_account_id,
      appointmentId: appointment.id,
      type: 'APPOINTMENT_CANCELLED',
      title: 'Cita cancelada',
      message: `Una cita asignada para ${startAt} fue cancelada.`,
    });
  }
}

export function listMyNotifications(organizationId, recipientUserAccountId, query) {
  const filter = parseStatusFilter(query?.status);
  const notifications = findByRecipient(organizationId, recipientUserAccountId, filter).map(
    toNotificationResponse
  );

  return {
    notifications,
    unreadCount: countUnread(organizationId, recipientUserAccountId),
  };
}

export function updateMyNotificationReadState(organizationId, recipientUserAccountId, notificationId, body) {
  const isRead = parseIsRead(body?.isRead);
  const current = findByRecipientAndId(organizationId, recipientUserAccountId, notificationId);

  if (!current) {
    throw httpError(404, 'Notificación no encontrada');
  }

  const alreadyInState = (isRead && current.is_read === 1) || (!isRead && current.is_read === 0);

  if (!alreadyInState) {
    setReadState(organizationId, recipientUserAccountId, notificationId, isRead);
  }

  return toNotificationResponse(
    findByRecipientAndId(organizationId, recipientUserAccountId, notificationId)
  );
}
