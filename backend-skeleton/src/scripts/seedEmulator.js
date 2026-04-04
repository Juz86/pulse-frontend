import { applyLocalFirestoreEmulatorEnv } from './emulatorEnv.js';

applyLocalFirestoreEmulatorEnv();

await import('./seed.js');
