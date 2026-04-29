import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, closeFirestoreApp } from '../services/firestore.js';
import { getFirebaseCredentialMode } from '../services/firebaseConfig.js';

const KNOWN_COLLECTIONS = [
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
  const requested = KNOWN_COLLECTIONS.map(toCanonicalCollectionName);
  const discovered = collectCollectionsFromBackendCode();
  return [...new Set([...requested, ...discovered])].sort();
}

async function countDocuments(collectionName) {
  try {
    const countSnap = await db.collection(collectionName).count().get();
    return countSnap.data().count || 0;
  } catch {
    let total = 0;
    let lastDoc = null;
    while (true) {
      let query = db.collection(collectionName).orderBy('__name__').limit(500);
      if (lastDoc) query = query.startAfter(lastDoc);
      const snap = await query.get();
      if (snap.empty) break;
      total += snap.size;
      lastDoc = snap.docs[snap.docs.length - 1];
    }
    return total;
  }
}

async function inspectFirestoreData() {
  const credentialMode = getFirebaseCredentialMode();
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '(none)';
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || '(none)';
  const collections = buildTargetCollections();

  console.log('Firestore inspect');
  console.log(`- Credential mode: ${credentialMode}`);
  console.log(`- FIRESTORE_EMULATOR_HOST: ${emulatorHost}`);
  console.log(`- FIREBASE_PROJECT_ID/GCLOUD_PROJECT: ${projectId}`);
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.log('! Let op: je gebruikt geen emulator-host. Dit kan productie/staging data zijn.');
  }
  console.log('');

  let total = 0;
  for (const name of collections) {
    const count = await countDocuments(name);
    total += count;
    console.log(`- ${name}: ${count} documenten`);
  }

  console.log('');
  console.log(`Totaal documenten over ${collections.length} collections: ${total}`);
}

try {
  await inspectFirestoreData();
  await closeFirestoreApp();
  process.exit(0);
} catch (error) {
  console.error(`Fout: ${error.message || error}`);
  await closeFirestoreApp();
  process.exit(1);
}
