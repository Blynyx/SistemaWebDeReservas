import {
  cancelAppointment,
  completeAppointment,
  createOwnAppointment,
  listAppointmentsByClient,
  listAppointmentsByProfessional,
  markNoShowAppointment,
  rescheduleAppointment,
} from '../appointments/appointment.service.js';
import {
  createAvailabilityBlock,
  listAvailabilityBlocks,
  patchAvailabilityBlock,
  removeAvailabilityBlock,
} from '../availabilityBlocks/availabilityBlock.service.js';
import { findByIds as findClientsByIds } from '../clients/client.repository.js';

export function getMyProfessional(professional) {
  return {
    professional: {
      id: professional.id,
      name: professional.name,
      email: professional.email,
      phone: professional.phone,
      isActive: professional.is_active,
    },
  };
}

export function getMyClient(client) {
  return {
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      isActive: client.is_active,
    },
  };
}

export async function listMyProfessionalAppointments(organizationId, professionalId, query) {
  const appointments = await listAppointmentsByProfessional(organizationId, professionalId, query);
  if (appointments.length === 0) {
    return appointments;
  }

  const clients = await findClientsByIds(
    organizationId,
    appointments.map((appointment) => appointment.clientId)
  );
  const clientNamesById = new Map(clients.map((client) => [client.id, client.name]));

  return appointments.map((appointment) => ({
    ...appointment,
    clientName: clientNamesById.get(appointment.clientId) ?? 'Cliente no disponible',
  }));
}

export async function listMyClientAppointments(organizationId, clientId, query) {
  return listAppointmentsByClient(organizationId, clientId, query);
}

export async function createMyAppointment(organizationId, clientId, body) {
  return createOwnAppointment(organizationId, clientId, body);
}

export async function cancelMyAppointment(organizationId, clientId, appointmentId) {
  return cancelAppointment(organizationId, appointmentId, {
    expectedClientId: clientId,
  });
}

export async function rescheduleMyAppointment(organizationId, clientId, appointmentId, body) {
  return rescheduleAppointment(
    organizationId,
    appointmentId,
    { startAt: body?.startAt },
    { expectedClientId: clientId }
  );
}

export async function completeMyAppointment(organizationId, professionalId, appointmentId) {
  return completeAppointment(organizationId, appointmentId, {
    expectedProfessionalId: professionalId,
  });
}

export async function markMyAppointmentNoShow(organizationId, professionalId, appointmentId) {
  return markNoShowAppointment(organizationId, appointmentId, {
    expectedProfessionalId: professionalId,
  });
}

export async function createMyAvailabilityBlock(organizationId, professionalId, body) {
  return createAvailabilityBlock(organizationId, professionalId, body);
}

export async function listMyAvailabilityBlocks(organizationId, professionalId) {
  return listAvailabilityBlocks(organizationId, professionalId);
}

export async function patchMyAvailabilityBlock(organizationId, professionalId, blockId, body) {
  return patchAvailabilityBlock(organizationId, professionalId, blockId, body);
}

export async function removeMyAvailabilityBlock(organizationId, professionalId, blockId) {
  await removeAvailabilityBlock(organizationId, professionalId, blockId);
}
