import { randomUUID } from 'node:crypto';
import { runInImmediateTransaction } from '../../database/transaction.js';
import { httpError } from '../../utils/httpError.js';
import { parseLoginEmail, parseLoginPassword } from '../../utils/credentials.js';
import { hashPassword } from '../../utils/password.js';
import {
  deactivate as deactivateUserAccount,
  findByOrganizationIdAndEmail,
  insertUserAccount,
} from '../userAccounts/userAccount.repository.js';
import {
  deactivateProfessional,
  findAllByOrganization,
  findById,
  insertProfessional,
  linkUserAccount,
  updateProfessional,
} from './professional.repository.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toProfessionalResponse(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    userAccountId: row.user_account_id,
    isActive: row.is_active,
  };
}

function requireTenantProfessional(organizationId, professionalId) {
  const professional = findById(organizationId, professionalId);

  if (!professional) {
    throw httpError(404, 'Profesional no encontrado');
  }

  return professional;
}

function parseOptionalEmail(email) {
  if (email === undefined) {
    return undefined;
  }

  if (typeof email !== 'string') {
    throw httpError(400, 'El correo electrónico no es válido');
  }

  const normalized = email.trim().toLowerCase();

  if (!normalized || !EMAIL_PATTERN.test(normalized)) {
    throw httpError(400, 'El correo electrónico no es válido');
  }

  return normalized;
}

function parseOptionalPhone(phone) {
  if (phone === undefined) {
    return undefined;
  }

  if (typeof phone !== 'string') {
    throw httpError(400, 'El teléfono no es válido');
  }

  const trimmed = phone.trim();

  if (!trimmed) {
    throw httpError(400, 'El teléfono no puede quedar vacío');
  }

  return trimmed;
}

function validateProfessionalFields(body, { partial }) {
  const fields = {};

  if (!partial || body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!name) {
      throw httpError(400, 'El nombre del profesional es obligatorio');
    }

    fields.name = name;
  }

  if (!partial || body.email !== undefined) {
    fields.email = partial ? parseOptionalEmail(body.email) : parseOptionalEmail(body.email) ?? null;
  }

  if (!partial || body.phone !== undefined) {
    fields.phone = partial ? parseOptionalPhone(body.phone) : parseOptionalPhone(body.phone) ?? null;
  }

  return fields;
}

export function createProfessional(organizationId, body) {
  const payload = body ?? {};
  const fields = validateProfessionalFields(payload, { partial: false });
  const id = randomUUID();

  insertProfessional({
    id,
    organizationId,
    name: fields.name,
    email: fields.email,
    phone: fields.phone,
  });

  return toProfessionalResponse(findById(organizationId, id));
}

export function listProfessionals(organizationId) {
  return findAllByOrganization(organizationId).map(toProfessionalResponse);
}

export function getProfessional(organizationId, professionalId) {
  return toProfessionalResponse(requireTenantProfessional(organizationId, professionalId));
}

export function patchProfessional(organizationId, professionalId, body) {
  const payload = body ?? {};
  const hasUpdatableField = ['name', 'email', 'phone'].some((field) => payload[field] !== undefined);

  if (!hasUpdatableField) {
    throw httpError(400, 'Debe enviar al menos un campo modificable');
  }

  requireTenantProfessional(organizationId, professionalId);

  const fields = validateProfessionalFields(payload, { partial: true });
  updateProfessional(organizationId, professionalId, {
    ...fields,
    updatedAt: new Date().toISOString(),
  });

  return toProfessionalResponse(findById(organizationId, professionalId));
}

export function removeProfessional(organizationId, professionalId) {
  runInImmediateTransaction(() => {
    const professional = requireTenantProfessional(organizationId, professionalId);

    if (professional.is_active !== 1) {
      return;
    }

    deactivateProfessional(organizationId, professionalId, new Date().toISOString());

    if (professional.user_account_id) {
      deactivateUserAccount(organizationId, professional.user_account_id);
    }
  });
}

export async function provisionProfessionalAccount(organizationId, professionalId, body) {
  const email = parseLoginEmail(body?.email);
  const password = parseLoginPassword(body?.password);
  const passwordHash = await hashPassword(password);

  return runInImmediateTransaction(() => {
    const professional = requireTenantProfessional(organizationId, professionalId);

    if (professional.is_active !== 1) {
      throw httpError(409, 'El profesional no está activo');
    }

    if (professional.user_account_id) {
      throw httpError(409, 'El profesional ya tiene una cuenta');
    }

    if (findByOrganizationIdAndEmail(organizationId, email)) {
      throw httpError(409, 'Ya existe una cuenta con ese correo');
    }

    const userAccountId = randomUUID();

    insertUserAccount({
      id: userAccountId,
      organizationId,
      email,
      passwordHash,
      role: 'PROFESSIONAL',
      isActive: 1,
    });

    linkUserAccount(organizationId, professional.id, userAccountId, new Date().toISOString());

    return {
      professionalId: professional.id,
      userAccount: {
        id: userAccountId,
        email,
        role: 'PROFESSIONAL',
        isActive: 1,
      },
    };
  });
}
