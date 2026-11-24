export function formatPriceMinorUnits(minorUnits) {
  if (!Number.isFinite(minorUnits)) {
    return '—';
  }

  return `$${(minorUnits / 100).toFixed(2)}`;
}
