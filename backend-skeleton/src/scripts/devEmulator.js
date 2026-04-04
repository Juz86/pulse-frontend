import { applyLocalFirestoreEmulatorEnv } from './emulatorEnv.js';

applyLocalFirestoreEmulatorEnv();

await import('../server.js');
