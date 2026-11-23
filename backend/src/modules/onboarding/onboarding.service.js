import { randomUUID } from 'node:crypto';
import { isDuplicateKeyError } from '../../database/mongodb/errors.js';
import { withTransaction } from '../../database/mongodb/transaction.js';
import { insertOrganization, slugExists } from '../organizations/organization.repository.js';
import { insertUserAccount } from '../userAccounts/userAccount.repository.js';
import { httpError } from '../../utils/httpError.js';
import { hashPassword } from '../../utils/password.js';
import { slugify, uniqueSlugCandidate } from '../../utils/slug.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SLUG_ATTEMPTS = 1000;

function validateOnboardingInput(body) {
  const organizationName =
    typeof body?.organizationName === 'string' ? body.organizationName.trim() : '';
  const adminEmail =
    typeof body?.adminEmail === 'string' ? body.adminEmail.trim().toLowerCase() : '';
  const adminPassword = typeof body?.adminPassword === 'string' ? body.adminPassword : '';

  if (!organizationName) {
    throw httpError(400, 'El nombre de la organización es obligatorio');
  }

  if (!adminEmail || !EMAIL_PATTERN.test(adminEmail)) {
    throw httpError(400, 'El correo electrónico no es válido');
  }

  if (!adminPassword || adminPassword.length < 8) {
    throw httpError(400, 'La contraseña debe tener al menos 8 caracteres');
  }

  return { organizationName, adminEmail, adminPassword };
}

async function resolveAvailableSlug(organizationName, session) {
  const baseSlug = slugify(organizationName);

  if (!baseSlug) {
    throw httpError(400, 'El nombre de la organización no es válido');
  }

  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt += 1) {
    const candidate = uniqueSlugCandidate(baseSlug, attempt);

    if (!(await slugExists(candidate, { session }))) {
      return candidate;
    }
  }

  throw httpError(409, 'No fue posible generar un identificador público único');
}

export async function onboardOrganization(body) {
  const { organizationName, adminEmail, adminPassword } = validateOnboardingInput(body);

  const organizationId = randomUUID();
  const adminId = randomUUID();
  const passwordHash = await hashPassword(adminPassword);

  try {
    return await withTransaction(async (session) => {
      const slug = await resolveAvailableSlug(organizationName, session);

      await insertOrganization(
        {
          id: organizationId,
          name: organizationName,
          slug,
        },
        { session }
      );

      await insertUserAccount(
        {
          id: adminId,
          organizationId,
          email: adminEmail,
          passwordHash,
          role: 'ADMIN',
          isActive: 1,
        },
        { session }
      );

      return {
        organization: {
          id: organizationId,
          name: organizationName,
          slug,
        },
        admin: {
          id: adminId,
          email: adminEmail,
          role: 'ADMIN',
        },
      };
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw httpError(409, 'No fue posible generar un identificador público único');
    }
    throw error;
  }
}
