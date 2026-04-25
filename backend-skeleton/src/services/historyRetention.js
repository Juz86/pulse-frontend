import { db } from './firestore.js';
import { applyConversationSummaryFields, deriveConversationSummary } from './conversationSummaries.js';

export const HISTORY_RETENTION_OPTIONS_DAYS = [1, 7, 14, 30];
export const DEFAULT_HISTORY_RETENTION_DAYS = 30;

function toIsoDate(value) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function sortByCreatedAtDesc(items = []) {
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a?.createdAt || 0);
    const bTime = Date.parse(b?.createdAt || 0);
    return bTime - aTime;
  });
}

function normalizeRetentionDays(value) {
  const numeric = Number(value);
  if (HISTORY_RETENTION_OPTIONS_DAYS.includes(numeric)) {
    return numeric;
  }
  return DEFAULT_HISTORY_RETENTION_DAYS;
}

export function computeHistoryExpiresAt(createdAt, retentionDays = DEFAULT_HISTORY_RETENTION_DAYS) {
  const createdAtMs = Date.parse(createdAt || Date.now());
  const safeCreatedAt = Number.isNaN(createdAtMs) ? Date.now() : createdAtMs;
  return new Date(
    safeCreatedAt + normalizeRetentionDays(retentionDays) * 24 * 60 * 60 * 1000
  ).toISOString();
}

export async function getParentHistorySettings(parentUid) {
  if (!parentUid) {
    return {
      retentionDays: DEFAULT_HISTORY_RETENTION_DAYS,
    };
  }

  const doc = await db.collection('parent_settings').doc(parentUid).get();
  const data = doc.exists ? doc.data() || {} : {};
  return {
    retentionDays: normalizeRetentionDays(data?.historyRules?.retentionDays),
  };
}

export async function getChildHistorySettings(childUid) {
  if (!childUid) {
    return {
      retentionDays: DEFAULT_HISTORY_RETENTION_DAYS,
    };
  }

  const doc = await db.collection('child_settings').doc(childUid).get();
  const data = doc.exists ? doc.data() || {} : {};
  return {
    retentionDays: normalizeRetentionDays(data?.historyRules?.retentionDays),
  };
}

export async function setParentHistorySettings(parentUid, retentionDays) {
  const normalizedDays = normalizeRetentionDays(retentionDays);
  const now = new Date().toISOString();

  await db.collection('parent_settings').doc(parentUid).set({
    parentUid,
    historyRules: {
      retentionDays: normalizedDays,
    },
    updatedAt: now,
  }, { merge: true });

  return {
    retentionDays: normalizedDays,
  };
}

export async function setChildHistorySettings(childUid, retentionDays, parentUid = null) {
  const normalizedDays = normalizeRetentionDays(retentionDays);
  const now = new Date().toISOString();

  await db.collection('child_settings').doc(childUid).set({
    childUid,
    parentUid: parentUid || null,
    historyRules: {
      retentionDays: normalizedDays,
    },
    updatedAt: now,
  }, { merge: true });

  return {
    retentionDays: normalizedDays,
  };
}

async function getUserRetentionSubject(userId) {
  if (!userId) return null;

  const doc = await db.collection('users').doc(userId).get();
  if (!doc.exists) {
    return { type: 'parent', uid: userId };
  }

  const data = doc.data() || {};
  if (data.role === 'child') {
    return {
      type: 'child',
      uid: userId,
      parentUid: data.parentUid || data.managedByParentId || null,
    };
  }

  return { type: 'parent', uid: userId };
}

async function resolveEffectiveUserRetentionDays(userId) {
  const subject = await getUserRetentionSubject(userId);
  if (!subject) return DEFAULT_HISTORY_RETENTION_DAYS;
  if (subject.type === 'child') {
    const settings = await getChildHistorySettings(subject.uid);
    return normalizeRetentionDays(settings.retentionDays);
  }
  const settings = await getParentHistorySettings(subject.uid);
  return normalizeRetentionDays(settings.retentionDays);
}

export async function resolveConversationRetentionDays(members = []) {
  const uniqueMemberIds = Array.from(new Set((Array.isArray(members) ? members : []).filter(Boolean)));
  if (!uniqueMemberIds.length) {
    return DEFAULT_HISTORY_RETENTION_DAYS;
  }

  const retentionDaysList = await Promise.all(
    uniqueMemberIds.map((memberUid) => resolveEffectiveUserRetentionDays(memberUid))
  );

  return retentionDaysList.reduce(
    (minDays, retentionDays) => Math.min(minDays, normalizeRetentionDays(retentionDays)),
    DEFAULT_HISTORY_RETENTION_DAYS
  );
}

export async function resolveUserHistoryRetentionDays(userId) {
  return resolveEffectiveUserRetentionDays(userId);
}

export async function purgeExpiredConversationHistory({ convId, members = [], conversationData = null }) {
  if (!convId) {
    return { deletedCount: 0, conversation: conversationData };
  }

  const retentionDays = await resolveConversationRetentionDays(members);
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  const messagesSnap = await db
    .collection('messages')
    .where('conversationId', '==', convId)
    .get();

  const messageDocs = messagesSnap.docs;
  const expiredDocs = messageDocs.filter((doc) => {
    const createdAtMs = Date.parse(doc.data()?.createdAt || 0);
    return !Number.isNaN(createdAtMs) && createdAtMs <= cutoffMs;
  });

  if (!expiredDocs.length) {
    return {
      deletedCount: 0,
      conversation: conversationData,
      retentionDays,
    };
  }

  await Promise.all(expiredDocs.map(async (doc) => {
    const messageId = doc.id;
    const receiptSnap = await db
      .collection('message_recipients')
      .where('messageId', '==', messageId)
      .get()
      .catch(() => ({ docs: [] }));

    await Promise.all([
      ...receiptSnap.docs.map((receiptDoc) => receiptDoc.ref.delete()),
      doc.ref.delete(),
    ]);
  }));

  const remainingMessages = sortByCreatedAtDesc(
    messageDocs
      .filter((doc) => !expiredDocs.some((expiredDoc) => expiredDoc.id === doc.id))
      .map((doc) => doc.data())
  );

  if (remainingMessages.length === 0) {
    await db.collection('conversations').doc(convId).delete().catch(() => {});
    return {
      deletedCount: expiredDocs.length,
      conversation: null,
      retentionDays,
      deletedConversation: true,
    };
  }

  const latestRemaining = remainingMessages[0] || null;
  const nextConversationData = applyConversationSummaryFields(
    {
      ...(conversationData || {}),
      updatedAt: latestRemaining?.createdAt || toIsoDate(),
    },
    deriveConversationSummary(latestRemaining, '')
  );

  await db.collection('conversations').doc(convId).set(nextConversationData, { merge: true });

  return {
    deletedCount: expiredDocs.length,
    conversation: nextConversationData,
    retentionDays,
  };
}
