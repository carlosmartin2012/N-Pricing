/**
 * Generate a cryptographically random ID with a given prefix.
 * Uses crypto.randomUUID() when available, falls back to crypto.getRandomValues().
 */
export const generateId = (prefix = ''): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    const uuid = crypto.randomUUID();
    return prefix ? `${prefix}-${uuid.slice(0, 8)}` : uuid;
  }
  // Fallback
  const array = new Uint32Array(2);
  crypto.getRandomValues(array);
  const id = Array.from(array, (v) => v.toString(36)).join('');
  return prefix ? `${prefix}-${id.slice(0, 8)}` : id;
};
