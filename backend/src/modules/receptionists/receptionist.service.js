import { randomUUID } from 'node:crypto';
import { isDuplicateKeyError } from '../../database/mongodb/errors.js';
import { httpError } from '../../utils/httpError.js';
import { hashPassword } from '../../utils/password.js';
import {
  findByIdAndRole,
  findReceptionistsByOrganization,
  insertUserAccount,
  setActiveState,
} from '../userAccounts/userAccount.repository.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RECEPTIONIST_ROLE = 'RECEPTIONIST';

function toReceptionistResponse(doc) {
  return {
    id: doc.id,
    email: doc.email,
    role: doc.role,
    isActive: Boolean(doc.isActive),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function validateCreateInput(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!email) {
    throw httpError(400, 'El correo electrónico es obligatorio');
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw httpError(400, 'El correo electrónico no es válido');
  }

  if (password.length < 8) {
    throw httpError(400, 'La contraseña debe tener al menos 8 caracteres');
  }

  return { email, password };
}

export async function listReceptionists(organizationId) {
  const docs = await findReceptionistsByOrganization(organizationId);
  return docs.map(toReceptionistResponse);
}

export async function createReceptionist(organizationId, body) {
  const { email, password } = validateCreateInput(body);
  const passwordHash = await hashPassword(password);
  const id = randomUUID();

  try {
    await insertUserAccount({
      id,
      organizationId,
      email,
      passwordHash,
      role: RECEPTIONIST_ROLE,
      isActive: true,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw httpError(409, 'Ya existe una cuenta con ese correo electrónico');
    }
    throw error;
  }

  const created = await findByIdAndRole(organizationId, id, RECEPTIONIST_ROLE);
  return toReceptionistResponse(created);
}

export async function updateReceptionistStatus(organizationId, receptionistId, body) {
  if (typeof body?.isActive !== 'boolean') {
    throw httpError(400, 'isActive es obligatorio y debe ser un boolean');
  }

  const existing = await findByIdAndRole(organizationId, receptionistId, RECEPTIONIST_ROLE);
  if (!existing) {
    throw httpError(404, 'Recepcionista no encontrado');
  }

  await setActiveState(organizationId, receptionistId, body.isActive);
  const updated = await findByIdAndRole(organizationId, receptionistId, RECEPTIONIST_ROLE);
  return toReceptionistResponse(updated);
}
