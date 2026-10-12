function byName(left, right) {
  return left.name.localeCompare(right.name, 'es');
}

export function createNameLookup(items, fallback) {
  const names = new Map((items ?? []).map((item) => [item.id, item.name]));

  return (id) => names.get(id) || fallback;
}

export function sortByName(items) {
  return [...(items ?? [])].sort(byName);
}
