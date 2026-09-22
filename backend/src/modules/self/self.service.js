import {
  completeAppointment,
  listAppointmentsByClient,
  listAppointmentsByProfessional,
  markNoShowAppointment,
} from '../appointments/appointment.service.js';
import {
  createAvailabilityBlock,
  listAvailabilityBlocks,
  patchAvailabilityBlock,
  removeAvailabilityBlock,
} from '../availabilityBlocks/availabilityBlock.service.js';

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

export function listMyProfessionalAppointments(organizationId, professionalId, query) {
  return listAppointmentsByProfessional(organizationId, professionalId, query);
}

export function listMyClientAppointments(organizationId, clientId, query) {
  return listAppointmentsByClient(organizationId, clientId, query);
}

export function completeMyAppointment(organizationId, professionalId, appointmentId) {
  return completeAppointment(organizationId, appointmentId, {
    expectedProfessionalId: professionalId,
  });
}

export function markMyAppointmentNoShow(organizationId, professionalId, appointmentId) {
  return markNoShowAppointment(organizationId, appointmentId, {
    expectedProfessionalId: professionalId,
  });
}

export function createMyAvailabilityBlock(organizationId, professionalId, body) {
  return createAvailabilityBlock(organizationId, professionalId, body);
}

export function listMyAvailabilityBlocks(organizationId, professionalId) {
  return listAvailabilityBlocks(organizationId, professionalId);
}

export function patchMyAvailabilityBlock(organizationId, professionalId, blockId, body) {
  return patchAvailabilityBlock(organizationId, professionalId, blockId, body);
}

export function removeMyAvailabilityBlock(organizationId, professionalId, blockId) {
  removeAvailabilityBlock(organizationId, professionalId, blockId);
}
