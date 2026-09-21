import { findById as findOrganizationById, findBySlug } from '../organizations/organization.repository.js';
import {
  findByIdAndOrganization,
  findByOrganizationIdAndEmail,
} from '../userAccounts/userAccount.repository.js';
import { httpError } from '../../utils/httpError.js';
import { signAuthToken } from '../../utils/jwt.js';
import { verifyPassword } from '../../utils/password.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID_CREDENTIALS = 'Credenciales inválidas';

function invalidCredentials() {
  return httpError(401, INVALID_CREDENTIALS);
}

function validateLoginInput(body) {
  const organizationSlug =
    typeof body?.organizationSlug === 'string' ? body.organizationSlug.trim().toLowerCase() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!organizationSlug) {
    throw httpError(400, 'El identificador de la organización es obligatorio');
  }

  if (!email || !EMAIL_PATTERN.test(email)) {
    throw httpError(400, 'El correo electrónico no es válido');
  }

  if (!password) {
    throw httpError(400, 'La contraseña es obligatoria');
  }

  return { organizationSlug, email, password };
}

export async function login(body) {
  const { organizationSlug, email, password } = validateLoginInput(body);

  const organization = findBySlug(organizationSlug);
  const user = organization
    ? findByOrganizationIdAndEmail(organization.id, email)
    : null;
  const passwordOk = user ? await verifyPassword(password, user.password_hash) : false;

  if (!organization || organization.is_active !== 1 || !user || user.is_active !== 1 || !passwordOk) {
    throw invalidCredentials();
  }

  const token = signAuthToken({
    userId: user.id,
    organizationId: organization.id,
    role: user.role,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
  };
}

export function resolveActiveIdentity(tokenUser) {
  if (!tokenUser?.id || !tokenUser?.organizationId) {
    throw httpError(401, 'No autenticado');
  }

  const user = findByIdAndOrganization(tokenUser.id, tokenUser.organizationId);

  if (!user || user.is_active !== 1) {
    throw httpError(401, 'No autenticado');
  }

  const organization = findOrganizationById(tokenUser.organizationId);

  if (!organization || organization.is_active !== 1) {
    throw httpError(401, 'No autenticado');
  }

  return {
    id: user.id,
    organizationId: user.organization_id,
    role: user.role,
    user,
    organization,
  };
}

export function getCurrentSession(authUser) {
  const { user, organization } = resolveActiveIdentity(authUser);

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
  };
}
