import { randomUUID } from 'node:crypto';
import { httpError } from '../../utils/httpError.js';
import {
  deactivateClient,
  findAllByOrganization,
  findById,
  insertClient,
  updateClient,
} from './client.repository.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toClientResponse(row) {
  return {
    id: row.id,
    userAccountId: row.user_account_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requireTenantClient(organizationId, clientId) {
  const client = findById(organizationId, clientId);

  if (!client) {
    throw httpError(404, 'Cliente no encontrado');
  }

  return client;
}

function parseName(name) {
  if (typeof name !== 'string') {
    throw httpError(400, 'El nombre del cliente es obligatorio');
  }

  const trimmed = name.trim();

  if (!trimmed) {
    throw httpError(400, 'El nombre del cliente es obligatorio');
  }

  return trimmed;
}

function parseEmail(email) {
  if (email === undefined) {
    return undefined;
  }

  if (email === null) {
    return null;
  }

  if (typeof email !== 'string') {
    throw httpError(400, 'El correo electrónico no es válido');
  }

  const normalized = email.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (!EMAIL_PATTERN.test(normalized)) {
    throw httpError(400, 'El correo electrónico no es válido');
  }

  return normalized;
}

function parsePhone(phone) {
  if (phone === undefined) {
    return undefined;
  }

  if (phone === null) {
    return null;
  }

  if (typeof phone !== 'string') {
    throw httpError(400, 'El teléfono no es válido');
  }

  const trimmed = phone.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateClientFields(body, { partial }) {
  const fields = {};

  if (!partial || body.name !== undefined) {
    fields.name = parseName(body.name);
  }

  if (!partial || body.email !== undefined) {
    const email = parseEmail(body.email);
    fields.email = partial ? email : email ?? null;
  }

  if (!partial || body.phone !== undefined) {
    const phone = parsePhone(body.phone);
    fields.phone = partial ? phone : phone ?? null;
  }

  return fields;
}

export function createClient(organizationId, body) {
  const payload = body ?? {};
  const fields = validateClientFields(payload, { partial: false });
  const id = randomUUID();

  insertClient({
    id,
    organizationId,
    name: fields.name,
    email: fields.email,
    phone: fields.phone,
  });

  return toClientResponse(findById(organizationId, id));
}

export function listClients(organizationId) {
  return findAllByOrganization(organizationId).map(toClientResponse);
}

export function getClient(organizationId, clientId) {
  return toClientResponse(requireTenantClient(organizationId, clientId));
}

export function patchClient(organizationId, clientId, body) {
  const payload = body ?? {};
  const hasUpdatableField = ['name', 'email', 'phone'].some((field) => payload[field] !== undefined);

  if (!hasUpdatableField) {
    throw httpError(400, 'Debe enviar al menos un campo modificable');
  }

  requireTenantClient(organizationId, clientId);

  const fields = validateClientFields(payload, { partial: true });
  updateClient(organizationId, clientId, {
    ...fields,
    updatedAt: new Date().toISOString(),
  });

  return toClientResponse(findById(organizationId, clientId));
}

export function removeClient(organizationId, clientId) {
  const client = requireTenantClient(organizationId, clientId);

  if (client.is_active === 1) {
    deactivateClient(organizationId, clientId, new Date().toISOString());
  }
}
