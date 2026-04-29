import fs from 'fs';
import path from 'path';
import readline from 'readline/promises';
import { fileURLToPath } from 'url';
import { db, closeFirestoreApp } from '../services/firestore.js';
import { getFirebaseCredentialMode } from '../services/firebaseConfig.js';

const BATCH_SIZE = Number(process.env.FIRESTORE_RESET_BATCH_SIZE || 100);
const RESET_CONFIRMATION_TOKEN = 'RESET';

const REQUESTED_COLLECTIONS = [
  'agenda',
  'approved_contacts',
  'child_policies',
  'child_settings',
  'conversations',
  'coparentInvitations',
  'devices',
  'email_verification_codes',
  'friendRequests',
  'messages',
  'parentActivities',
  'parent_settings',
  'policy_events',
];

const COLLECTION_ALIASES = {
  friendRequests: 'friend_requests',
};

function toCanonicalCollectionName(name) {
  return COLLECTION_ALIASES[name] || name;
}

function collectCollectionsFromBackendCode() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const srcRoot = path.resolve(__dirname, '..');
  const discovered = new Set();

  function walk(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile() || !/\.(js|ts)$/.test(entry.name)) continue;

      const source = fs.readFileSync(fullPath, 'utf8');
      for (const match of source.matchAll(/collection\((['"])([^'"\n]+)\1\)/g)) {
        discovered.add(match[2]);
      }
    }
  }

  walk(srcRoot);
  return [...discovered].map(toCanonicalCollectionName).sort();
}

function buildTargetCollections() {
  const discovered = collectCollectionsFromBackendCode();
  const requested = REQUESTED_COLLECTIONS.map(toCanonicalCollectionName);
  const all = new Set([...requested, ...discovered]);
  return {
    requested: [...new Set(requested)].sort(),
    discovered,
    all: [...all].sort(),
  };
}

function assertSafeEnvironment() {
  if (String(process.env.NODE_ENV).toLowerCase() === 'production') {
    throw new Error('Veiligheidsstop: script mag niet draaien met NODE_ENV=production.');
  }

  const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
  const explicitBypass = process.env.ALLOW_FIRESTORE_RESET === 'true';
  if (!usingEmulator && !explicitBypass) {
    throw new Error(
      [
        'Veiligheidsstop: geen FIRESTORE_EMULATOR_HOST gevonden.',
        'Gebruik de emulator OF zet tijdelijk ALLOW_FIRESTORE_RESET=true.',
      ].join(' ')
    );
  }
}

async function confirmReset() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(
      `Typ "${RESET_CONFIRMATION_TOKEN}" om door te gaan: `
    );
    if (answer.trim() !== RESET_CONFIRMATION_TOKEN) {
      throw new Error('Reset geannuleerd: bevestiging klopt niet.');
    }
  } finally {
    rl.close();
  }
}

async function deleteCollectionRecursive(collectionRef, topLevelCollection, stats) {
  while (true) {
    const snap = await collectionRef.limit(BATCH_SIZE).get();
    if (snap.empty) return;

    for (const doc of snap.docs) {
      const subcollections = await doc.ref.listCollections();
      for (const subcollection of subcollections) {
        await deleteCollectionRecursive(subcollection, topLevelCollection, stats);
      }
    }

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();

    stats[topLevelCollection] = (stats[topLevelCollection] || 0) + snap.size;
  }
}

async function resetFirestoreData() {
  assertSafeEnvironment();

  const collections = buildTargetCollections();
  const credentialMode = getFirebaseCredentialMode();
  const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

  console.log('Firestore reset (development) - planning');
  console.log(`- Credential mode: ${credentialMode}`);
  console.log(`- Emulator: ${usingEmulator ? `ja (${process.env.FIRESTORE_EMULATOR_HOST})` : 'nee'}`);
  console.log(`- Batch size: ${BATCH_SIZE}`);
  console.log(`- Requested collections (${collections.requested.length}): ${collections.requested.join(', ')}`);
  console.log(`- Discovered in backend code (${collections.discovered.length}): ${collections.discovered.join(', ')}`);
  console.log(`- Final reset list (${collections.all.length}): ${collections.all.join(', ')}`);
  console.log('');
  console.log('Let op: alleen documenten worden verwijderd. Collections worden niet expliciet verwijderd.');
  console.log('');

  await confirmReset();

  const stats = {};
  let totalDeleted = 0;

  for (const collectionName of collections.all) {
    const before = stats[collectionName] || 0;
    await deleteCollectionRecursive(db.collection(collectionName), collectionName, stats);
    const deleted = (stats[collectionName] || 0) - before;
    totalDeleted += deleted;
    console.log(`- ${collectionName}: ${deleted} documenten verwijderd`);
  }

  console.log('');
  console.log(`Klaar. Totaal verwijderd: ${totalDeleted} documenten.`);
}

try {
  await resetFirestoreData();
  await closeFirestoreApp();
  process.exit(0);
} catch (error) {
  console.error(`Fout: ${error.message || error}`);
  await closeFirestoreApp();
  process.exit(1);
}
