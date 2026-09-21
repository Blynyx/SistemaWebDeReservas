import { randomUUID } from 'node:crypto';
import { httpError } from '../../utils/httpError.js';
import {
  deactivateService,
  findAllByOrganization,
  findById,
  insertService,
  updateService,
} from './service.repository.js';

function toServiceResponse(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
    priceMinorUnits: row.price_minor_units,
    isActive: row.is_active,
  };
}

function requireTenantService(organizationId, serviceId) {
  const service = findById(organizationId, serviceId);

  if (!service) {
    throw httpError(404, 'Servicio no encontrado');
  }

  return service;
}

function parseOptionalDescription(description) {
  if (description === undefined) {
    return undefined;
  }

  if (description === null) {
    return null;
  }

  if (typeof description !== 'string') {
    throw httpError(400, 'La descripción no es válida');
  }

  const trimmed = description.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateServiceFields(body, { partial }) {
  const fields = {};

  if (!partial || body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!name) {
      throw httpError(400, 'El nombre del servicio es obligatorio');
    }

    fields.name = name;
  }

  if (!partial || body.description !== undefined) {
    fields.description = parseOptionalDescription(body.description ?? null);
  }

  if (!partial || body.durationMinutes !== undefined) {
    if (!Number.isInteger(body.durationMinutes) || body.durationMinutes <= 0) {
      throw httpError(400, 'La duración debe ser un entero mayor que 0');
    }

    fields.durationMinutes = body.durationMinutes;
  }

  if (!partial || body.priceMinorUnits !== undefined) {
    if (!Number.isInteger(body.priceMinorUnits) || body.priceMinorUnits < 0) {
      throw httpError(400, 'El precio debe ser un entero mayor o igual que 0');
    }

    fields.priceMinorUnits = body.priceMinorUnits;
  }

  return fields;
}

export function createService(organizationId, body) {
  const fields = validateServiceFields(body ?? {}, { partial: false });
  const id = randomUUID();

  insertService({
    id,
    organizationId,
    ...fields,
  });

  return toServiceResponse(findById(organizationId, id));
}

export function listServices(organizationId) {
  return findAllByOrganization(organizationId).map(toServiceResponse);
}

export function getService(organizationId, serviceId) {
  return toServiceResponse(requireTenantService(organizationId, serviceId));
}

export function patchService(organizationId, serviceId, body) {
  const payload = body ?? {};
  const hasUpdatableField = ['name', 'description', 'durationMinutes', 'priceMinorUnits'].some(
    (field) => payload[field] !== undefined
  );

  if (!hasUpdatableField) {
    throw httpError(400, 'Debe enviar al menos un campo modificable');
  }

  requireTenantService(organizationId, serviceId);

  const fields = validateServiceFields(payload, { partial: true });
  updateService(organizationId, serviceId, {
    ...fields,
    updatedAt: new Date().toISOString(),
  });

  return toServiceResponse(findById(organizationId, serviceId));
}

export function removeService(organizationId, serviceId) {
  const service = requireTenantService(organizationId, serviceId);

  if (service.is_active === 1) {
    deactivateService(organizationId, serviceId, new Date().toISOString());
  }
}
