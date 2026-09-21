import { findById as findProfessionalById } from '../professionals/professional.repository.js';
import { findById as findServiceById } from '../services/service.repository.js';
import { httpError } from '../../utils/httpError.js';
import {
  assignmentExists,
  findAssignment,
  findServicesByProfessional,
  insertAssignment,
  removeAssignment,
} from './professionalService.repository.js';

function toAssignedServiceResponse(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
    priceMinorUnits: row.price_minor_units,
    isActive: row.is_active,
  };
}

function requireTenantProfessional(organizationId, professionalId) {
  const professional = findProfessionalById(organizationId, professionalId);

  if (!professional) {
    throw httpError(404, 'Profesional no encontrado');
  }

  return professional;
}

function requireTenantService(organizationId, serviceId) {
  const service = findServiceById(organizationId, serviceId);

  if (!service) {
    throw httpError(404, 'Servicio no encontrado');
  }

  return service;
}

function parseServiceId(serviceId) {
  if (typeof serviceId !== 'string' || serviceId.trim() === '') {
    throw httpError(400, 'El identificador del servicio es obligatorio');
  }

  return serviceId.trim();
}

export function assignServiceToProfessional(organizationId, professionalId, body) {
  const serviceId = parseServiceId(body?.serviceId);
  const professional = requireTenantProfessional(organizationId, professionalId);
  const service = requireTenantService(organizationId, serviceId);

  if (professional.is_active !== 1) {
    throw httpError(409, 'El profesional no está activo');
  }

  if (service.is_active !== 1) {
    throw httpError(409, 'El servicio no está activo');
  }

  if (assignmentExists(organizationId, professionalId, serviceId)) {
    throw httpError(409, 'El servicio ya está asignado a este profesional');
  }

  insertAssignment({ organizationId, professionalId, serviceId });

  const assignment = findAssignment(organizationId, professionalId, serviceId);

  return {
    professionalId: assignment.professional_id,
    serviceId: assignment.service_id,
    createdAt: assignment.created_at,
  };
}

export function listAssignedServices(organizationId, professionalId) {
  requireTenantProfessional(organizationId, professionalId);

  return findServicesByProfessional(organizationId, professionalId).map(toAssignedServiceResponse);
}

export function unassignServiceFromProfessional(organizationId, professionalId, serviceId) {
  requireTenantProfessional(organizationId, professionalId);
  requireTenantService(organizationId, parseServiceId(serviceId));
  removeAssignment(organizationId, professionalId, serviceId);
}
