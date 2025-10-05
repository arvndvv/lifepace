export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  const array = new Uint32Array(4);
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(array);
    return Array.from(array, (n) => n.toString(16).padStart(8, '0')).join('');
  }

  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}
