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

async function requireTenantProfessional(organizationId, professionalId) {
  const professional = await findProfessionalById(organizationId, professionalId);

  if (!professional) {
    throw httpError(404, 'Profesional no encontrado');
  }

  return professional;
}

async function requireTenantService(organizationId, serviceId) {
  const service = await findServiceById(organizationId, serviceId);

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

export async function assignServiceToProfessional(organizationId, professionalId, body) {
  const serviceId = parseServiceId(body?.serviceId);
  const professional = await requireTenantProfessional(organizationId, professionalId);
  const service = await requireTenantService(organizationId, serviceId);

  if (professional.is_active !== 1) {
    throw httpError(409, 'El profesional no está activo');
  }

  if (service.is_active !== 1) {
    throw httpError(409, 'El servicio no está activo');
  }

  if (await assignmentExists(organizationId, professionalId, serviceId)) {
    throw httpError(409, 'El servicio ya está asignado a este profesional');
  }

  await insertAssignment({ organizationId, professionalId, serviceId });

  const assignment = await findAssignment(organizationId, professionalId, serviceId);

  return {
    professionalId: assignment.professional_id,
    serviceId: assignment.service_id,
    createdAt: assignment.created_at,
  };
}

export async function listAssignedServices(organizationId, professionalId) {
  await requireTenantProfessional(organizationId, professionalId);

  const services = await findServicesByProfessional(organizationId, professionalId);
  return services.map(toAssignedServiceResponse);
}

export async function unassignServiceFromProfessional(organizationId, professionalId, serviceId) {
  await requireTenantProfessional(organizationId, professionalId);
  await requireTenantService(organizationId, parseServiceId(serviceId));
  await removeAssignment(organizationId, professionalId, serviceId);
}
