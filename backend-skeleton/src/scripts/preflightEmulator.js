import { applyLocalFirestoreEmulatorEnv } from './emulatorEnv.js';

applyLocalFirestoreEmulatorEnv();

await import('./preflight.js');
