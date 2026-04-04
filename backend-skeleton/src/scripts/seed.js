import { closeFirestoreApp, db } from '../services/firestore.js';

async function seed() {
  const now = new Date().toISOString();

  await db.collection('users').doc('uid_parent_1').set({
    uid: 'uid_parent_1',
    displayName: 'Ouder Demo',
    email: 'parent@example.com',
    role: 'parent',
    createdAt: now,
    status: 'active',
  }, { merge: true });

  await db.collection('users').doc('uid_child_1').set({
    uid: 'uid_child_1',
    displayName: 'Sara',
    username: 'sara123',
    email: 'sara@example.com',
    role: 'child',
    parentUid: 'uid_parent_1',
    managedByParentId: 'uid_parent_1',
    createdAt: now,
    status: 'active',
  }, { merge: true });

  await db.collection('users').doc('uid_contact_9').set({
    uid: 'uid_contact_9',
    displayName: 'Oma',
    email: 'oma@example.com',
    role: 'user',
    createdAt: now,
    status: 'active',
  }, { merge: true });

  await db.collection('child_policies').doc('uid_child_1').set({
    childId: 'uid_child_1',
    managedByParentId: 'uid_parent_1',
    contactRules: {
      requiresParentApproval: true,
      allowOnlyApprovedContacts: true,
    },
    featureRules: {
      chat: true,
      call: true,
      video: false,
    },
    visibilityRules: {
      showUsageStatsToParent: true,
      showContactListToParent: true,
      showMessageContentToParent: false,
    },
    scheduleRules: {
      quietHoursEnabled: false,
      quietHoursStart: null,
      quietHoursEnd: null,
      timezone: 'Europe/Amsterdam',
    },
    updatedAt: now,
  }, { merge: true });

  await db.collection('approved_contacts').doc('uid_child_1_uid_contact_9').set({
    childId: 'uid_child_1',
    targetUid: 'uid_contact_9',
    displayName: 'Oma',
    approved: true,
    approvedByParentId: 'uid_parent_1',
    chat: true,
    call: true,
    video: false,
    blocked: false,
    createdAt: now,
  }, { merge: true });

  await db.collection('conversations').doc('conv_1').set({
    id: 'conv_1',
    members: ['uid_child_1', 'uid_contact_9'],
    memberNames: {
      uid_child_1: 'Sara',
      uid_contact_9: 'Oma',
    },
    isGroup: false,
    updatedAt: now,
    lastMessage: 'Versleuteld bericht',
    lastCallDirection: null,
    lastCallSenderId: null,
    lastCallIsVideo: null,
  }, { merge: true });

  await db.collection('devices').doc('device_child_1').set({
    id: 'device_child_1',
    userId: 'uid_child_1',
    deviceLabel: 'Demo Child Device',
    identityPublicKey: 'child-identity-public-key',
    signedPreKey: {
      keyId: 1,
      publicKey: 'child-signed-prekey-public',
      signature: 'child-signed-prekey-signature',
    },
    signedPreKeyRotatedAt: now,
    oneTimePreKeys: [
      { keyId: 1, publicKey: 'child-onetime-1' },
      { keyId: 2, publicKey: 'child-onetime-2' },
      { keyId: 3, publicKey: 'child-onetime-3' },
    ],
    oneTimePreKeyCount: 3,
    platform: 'web',
    protocol: 'signal_v1',
    protocolVersion: 1,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    revokedAt: null,
  }, { merge: true });

  await db.collection('devices').doc('device_contact_9').set({
    id: 'device_contact_9',
    userId: 'uid_contact_9',
    deviceLabel: 'Demo Contact Device',
    identityPublicKey: 'contact-identity-public-key',
    signedPreKey: {
      keyId: 1,
      publicKey: 'contact-signed-prekey-public',
      signature: 'contact-signed-prekey-signature',
    },
    signedPreKeyRotatedAt: now,
    oneTimePreKeys: [
      { keyId: 11, publicKey: 'contact-onetime-11' },
      { keyId: 12, publicKey: 'contact-onetime-12' },
      { keyId: 13, publicKey: 'contact-onetime-13' },
    ],
    oneTimePreKeyCount: 3,
    platform: 'web',
    protocol: 'signal_v1',
    protocolVersion: 1,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    revokedAt: null,
  }, { merge: true });

  console.log('Seed data geschreven voor Pulse backend skeleton.');
}

try {
  await seed();
  await closeFirestoreApp();
  process.exit(0);
} catch (error) {
  console.error(error);
  await closeFirestoreApp();
  process.exit(1);
}
