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

async function notifyRecipient(
  {
    organizationId,
    recipientUserAccountId,
    appointmentId,
    type,
    title,
    message,
  },
  { session } = {}
) {
  if (!recipientUserAccountId) {
    return;
  }

  await insertNotification(
    {
      id: randomUUID(),
      organizationId,
      recipientUserAccountId,
      appointmentId,
      type,
      title,
      message,
    },
    { session }
  );
}

export async function createAppointmentEventNotifications(
  {
    organizationId,
    appointment,
    eventType,
    previousStartAt = null,
    previousClientId = null,
    previousProfessionalId = null,
  },
  { session } = {}
) {
  const client = await findClientById(organizationId, appointment.client_id, { session });
  const professional = await findProfessionalById(
    organizationId,
    appointment.professional_id,
    { session }
  );
  const startAt = appointment.start_at;

  if (eventType === 'CREATED') {
    await notifyRecipient(
      {
        organizationId,
        recipientUserAccountId: client?.user_account_id,
        appointmentId: appointment.id,
        type: 'APPOINTMENT_CREATED',
        title: 'Reserva creada',
        message: `Tu cita del ${startAt} fue creada correctamente.`,
      },
      { session }
    );
    await notifyRecipient(
      {
        organizationId,
        recipientUserAccountId: professional?.user_account_id,
        appointmentId: appointment.id,
        type: 'APPOINTMENT_ASSIGNED',
        title: 'Nueva cita asignada',
        message: `Se te asignó una nueva cita para ${startAt}.`,
      },
      { session }
    );
    return;
  }

  if (eventType === 'CONFIRMED') {
    await notifyRecipient(
      {
        organizationId,
        recipientUserAccountId: client?.user_account_id,
        appointmentId: appointment.id,
        type: 'APPOINTMENT_CONFIRMED',
        title: 'Cita confirmada',
        message: `Tu cita del ${startAt} fue confirmada.`,
      },
      { session }
    );
    return;
  }

  if (eventType === 'RESCHEDULED') {
    await notifyRecipient(
      {
        organizationId,
        recipientUserAccountId: client?.user_account_id,
        appointmentId: appointment.id,
        type: 'APPOINTMENT_RESCHEDULED',
        title: 'Cita reprogramada',
        message: `Tu cita fue reprogramada de ${previousStartAt} a ${startAt}.`,
      },
      { session }
    );
    await notifyRecipient(
      {
        organizationId,
        recipientUserAccountId: professional?.user_account_id,
        appointmentId: appointment.id,
        type: 'APPOINTMENT_RESCHEDULED',
        title: 'Cita reprogramada',
        message: `Una cita asignada fue reprogramada de ${previousStartAt} a ${startAt}.`,
      },
      { session }
    );
    return;
  }

  if (eventType === 'CANCELLED') {
    await notifyRecipient(
      {
        organizationId,
        recipientUserAccountId: client?.user_account_id,
        appointmentId: appointment.id,
        type: 'APPOINTMENT_CANCELLED',
        title: 'Cita cancelada',
        message: `Tu cita del ${startAt} fue cancelada.`,
      },
      { session }
    );
    await notifyRecipient(
      {
        organizationId,
        recipientUserAccountId: professional?.user_account_id,
        appointmentId: appointment.id,
        type: 'APPOINTMENT_CANCELLED',
        title: 'Cita cancelada',
        message: `Una cita asignada para ${startAt} fue cancelada.`,
      },
      { session }
    );
    return;
  }

  if (eventType === 'UPDATED') {
    await notifyRecipient(
      {
        organizationId,
        recipientUserAccountId: client?.user_account_id,
        appointmentId: appointment.id,
        type: 'APPOINTMENT_UPDATED',
        title: 'Cita actualizada',
        message: `La cita del ${startAt} fue actualizada.`,
      },
      { session }
    );
    await notifyRecipient(
      {
        organizationId,
        recipientUserAccountId: professional?.user_account_id,
        appointmentId: appointment.id,
        type: 'APPOINTMENT_UPDATED',
        title: 'Cita actualizada',
        message: `La cita del ${startAt} fue actualizada.`,
      },
      { session }
    );

    if (previousClientId && previousClientId !== appointment.client_id) {
      const previousClient = await findClientById(organizationId, previousClientId, { session });
      await notifyRecipient(
        {
          organizationId,
          recipientUserAccountId: previousClient?.user_account_id,
          appointmentId: appointment.id,
          type: 'APPOINTMENT_REASSIGNED',
          title: 'Cita reasignada',
          message: `La cita del ${startAt} fue reasignada.`,
        },
        { session }
      );
    }

    if (previousProfessionalId && previousProfessionalId !== appointment.professional_id) {
      const previousProfessional = await findProfessionalById(
        organizationId,
        previousProfessionalId,
        { session }
      );
      await notifyRecipient(
        {
          organizationId,
          recipientUserAccountId: previousProfessional?.user_account_id,
          appointmentId: appointment.id,
          type: 'APPOINTMENT_REASSIGNED',
          title: 'Cita reasignada',
          message: `La cita del ${startAt} fue reasignada.`,
        },
        { session }
      );
    }
  }
}

export async function listMyNotifications(organizationId, recipientUserAccountId, query) {
  const filter = parseStatusFilter(query?.status);
  const rows = await findByRecipient(organizationId, recipientUserAccountId, filter);
  const unreadCount = await countUnread(organizationId, recipientUserAccountId);

  return {
    notifications: rows.map(toNotificationResponse),
    unreadCount,
  };
}

export async function updateMyNotificationReadState(
  organizationId,
  recipientUserAccountId,
  notificationId,
  body
) {
  const isRead = parseIsRead(body?.isRead);
  const current = await findByRecipientAndId(
    organizationId,
    recipientUserAccountId,
    notificationId
  );

  if (!current) {
    throw httpError(404, 'Notificación no encontrada');
  }

  const alreadyInState = (isRead && current.is_read === 1) || (!isRead && current.is_read === 0);

  if (!alreadyInState) {
    await setReadState(organizationId, recipientUserAccountId, notificationId, isRead);
  }

  return toNotificationResponse(
    await findByRecipientAndId(organizationId, recipientUserAccountId, notificationId)
  );
}
