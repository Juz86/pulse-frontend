const STORAGE_KEY = 'pulse_push_installation_id';

function browserRuntime() {
  return typeof window === 'undefined' ? {} : window;
}

function generateInstallationId() {
  const runtime = browserRuntime();
  if (runtime.crypto?.randomUUID) return runtime.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (!runtime.crypto?.getRandomValues) {
    throw new Error('Secure push installation identity is unavailable');
  }
  runtime.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

export function getOrCreatePushInstallationId(storage, generate = generateInstallationId) {
  const resolvedStorage = storage || browserRuntime().localStorage;
  const existing = resolvedStorage?.getItem(STORAGE_KEY)?.trim();
  if (existing) return existing;
  const generated = generate();
  resolvedStorage?.setItem(STORAGE_KEY, generated);
  return generated;
}
