export function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function uniqueSlugCandidate(baseSlug, attempt) {
  return attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`;
}
