import { applyLocalFirestoreEmulatorEnv } from './emulatorEnv.js';

applyLocalFirestoreEmulatorEnv();

const { db, closeFirestoreApp } = await import('../services/firestore.js');

async function deleteDocumentTree(docRef) {
  const subcollections = await docRef.listCollections();
  for (const subcollection of subcollections) {
    await deleteCollection(subcollection);
  }
  await docRef.delete();
}

async function deleteCollection(collectionRef) {
  while (true) {
    const snap = await collectionRef.limit(100).get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      await deleteDocumentTree(doc.ref);
    }
  }
}

async function wipe() {
  const collections = await db.listCollections();
  for (const collection of collections) {
    await deleteCollection(collection);
  }
  console.log('Lokale Firestore Emulator data volledig verwijderd.');
}

try {
  await wipe();
  await closeFirestoreApp();
  process.exit(0);
} catch (error) {
  console.error(error);
  await closeFirestoreApp();
  process.exit(1);
}
