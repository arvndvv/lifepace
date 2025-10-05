export function createId() {
    if (typeof globalThis.crypto !== 'undefined') {
        if ('randomUUID' in globalThis.crypto)
            return globalThis.crypto.randomUUID();
        if ('getRandomValues' in globalThis.crypto) {
            const arr = new Uint32Array(4);
            (globalThis?.crypto).getRandomValues(arr);
            return Array.from(arr, n => n.toString(16).padStart(8, '0')).join('');
        }
    }
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}
