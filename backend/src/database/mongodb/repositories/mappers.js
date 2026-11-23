export function toLegacyBoolean(value) {
  return value ? 1 : 0;
}

export function requireOrganizationId(organizationId) {
  if (typeof organizationId !== 'string' || organizationId.trim() === '') {
    throw new Error('organizationId es obligatorio para operaciones tenant-scoped');
  }
}

export function mapOrganizationToLegacy(doc) {
  if (!doc) {
    return null;
  }

  return {
    id: doc.id,
    name: doc.name,
    slug: doc.slug,
    is_active: toLegacyBoolean(doc.isActive),
  };
}

export function mapUserAccountToLegacy(doc, { includePasswordHash = false } = {}) {
  if (!doc) {
    return null;
  }

  const row = {
    id: doc.id,
    organization_id: doc.organizationId,
    email: doc.email,
    role: doc.role,
    is_active: toLegacyBoolean(doc.isActive),
  };

  if (includePasswordHash) {
    row.password_hash = doc.passwordHash;
  }

  return row;
}

export function mapServiceToLegacy(doc) {
  if (!doc) {
    return null;
  }

  return {
    id: doc.id,
    organization_id: doc.organizationId,
    name: doc.name,
    description: doc.description ?? null,
    duration_minutes: doc.durationMinutes,
    price_minor_units: doc.priceMinorUnits,
    is_active: toLegacyBoolean(doc.isActive),
    created_at: doc.createdAt ?? null,
    updated_at: doc.updatedAt ?? null,
  };
}

export function mapProfessionalToLegacy(doc) {
  if (!doc) {
    return null;
  }

  return {
    id: doc.id,
    organization_id: doc.organizationId,
    user_account_id: doc.userAccountId ?? null,
    name: doc.name,
    email: doc.email ?? null,
    phone: doc.phone ?? null,
    is_active: toLegacyBoolean(doc.isActive),
    created_at: doc.createdAt ?? null,
    updated_at: doc.updatedAt ?? null,
  };
}

export function mapClientToLegacy(doc) {
  if (!doc) {
    return null;
  }

  return {
    id: doc.id,
    organization_id: doc.organizationId,
    user_account_id: doc.userAccountId ?? null,
    name: doc.name,
    email: doc.email ?? null,
    phone: doc.phone ?? null,
    is_active: toLegacyBoolean(doc.isActive),
    created_at: doc.createdAt ?? null,
    updated_at: doc.updatedAt ?? null,
  };
}
