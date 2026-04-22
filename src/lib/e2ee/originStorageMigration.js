import { MARKETING_URL, WEB_APP_URL } from '../../config/runtimeConfig';
import { secureKeyStore } from './secureKeyStore';
import { sessionStore } from './sessionStore';

const LEGACY_IMPORT_SUCCESS_PREFIX = 'pulse_e2ee_origin_import_success_';
const LEGACY_IMPORT_ATTEMPT_PREFIX = 'pulse_e2ee_origin_import_attempt_';
const LEGACY_BRIDGE_PATH = '/e2ee-storage-bridge.html';
const LEGACY_WINDOW_NAME_PREFIX = 'pulse:e2ee-export:';
const LEGACY_IMPORT_QUERY_FLAG = 'pulse_e2ee_import';
const LEGACY_IMPORT_UID_PARAM = 'pulse_e2ee_uid';

function getLegacyImportSuccessKey(uid) {
  return `${LEGACY_IMPORT_SUCCESS_PREFIX}${uid}`;
}

function getLegacyImportAttemptKey(uid) {
  return `${LEGACY_IMPORT_ATTEMPT_PREFIX}${uid}`;
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function wasLegacyImportSuccessful(uid) {
  if (!canUseStorage()) return false;
  return localStorage.getItem(getLegacyImportSuccessKey(uid)) === '1';
}

function markLegacyImportSuccessful(uid) {
  if (!canUseStorage()) return;
  localStorage.setItem(getLegacyImportSuccessKey(uid), '1');
  sessionStorage.removeItem(getLegacyImportAttemptKey(uid));
}

function markLegacyImportAttempted(uid) {
  if (!canUseStorage()) return;
  sessionStorage.setItem(getLegacyImportAttemptKey(uid), '1');
}

function wasLegacyImportAttempted(uid) {
  if (!canUseStorage()) return false;
  return sessionStorage.getItem(getLegacyImportAttemptKey(uid)) === '1';
}

function getLegacyBridgeUrl() {
  return `${MARKETING_URL}${LEGACY_BRIDGE_PATH}`;
}

function isWebAppRuntime() {
  return typeof window !== 'undefined' && window.location.origin === WEB_APP_URL;
}

function isImportPayloadForUser(payload, uid) {
  return payload && typeof payload === 'object' && payload.uid === uid;
}

function normalizeImportedIdentity(identity, uid) {
  if (!identity || typeof identity !== 'object') return null;
  if (identity.userId !== uid) return null;
  if (!identity.identityKeyPair?.publicKey || !identity.identityKeyPair?.privateKey) return null;
  return identity;
}

function normalizeImportedSessions(sessions, uid) {
  if (!Array.isArray(sessions)) return [];
  return sessions.filter((record) => (
    record
    && typeof record === 'object'
    && typeof record.remoteUserId === 'string'
    && record.remoteUserId
    && typeof record.remoteDeviceId === 'string'
    && record.remoteDeviceId
    && typeof record.sessionData === 'string'
    && record.sessionData
    && record.ownerUid === uid
  )).map((record) => ({
    remoteUserId: record.remoteUserId,
    remoteDeviceId: record.remoteDeviceId,
    sessionData: record.sessionData,
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || new Date().toISOString(),
  }));
}

async function requestLegacyE2EEExport(uid) {
  if (typeof window === 'undefined') return null;

  const returnUrl = new URL(window.location.href);
  returnUrl.searchParams.set(LEGACY_IMPORT_QUERY_FLAG, '1');
  returnUrl.searchParams.set(LEGACY_IMPORT_UID_PARAM, uid);

  const bridgeUrl = new URL(getLegacyBridgeUrl());
  bridgeUrl.searchParams.set('uid', uid);
  bridgeUrl.searchParams.set('returnTo', returnUrl.toString());

  window.location.assign(bridgeUrl.toString());
  return null;
}

function tryReadImportedPayloadFromWindowName(uid) {
  if (typeof window === 'undefined') return null;
  if (!window.name || !window.name.startsWith(LEGACY_WINDOW_NAME_PREFIX)) return null;

  try {
    const parsed = JSON.parse(window.name.slice(LEGACY_WINDOW_NAME_PREFIX.length));
    if (!isImportPayloadForUser(parsed, uid)) return null;
    return parsed.payload || null;
  } catch {
    return null;
  } finally {
    window.name = '';
  }
}

function stripImportQueryParams() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete(LEGACY_IMPORT_QUERY_FLAG);
  url.searchParams.delete(LEGACY_IMPORT_UID_PARAM);
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

export async function importLegacyE2EEStateIfNeeded(uid) {
  if (!uid || !isWebAppRuntime()) return false;

  const currentIdentity = await secureKeyStore.getIdentity(uid);
  if (currentIdentity) {
    if (new URL(window.location.href).searchParams.get(LEGACY_IMPORT_QUERY_FLAG) === '1') {
      stripImportQueryParams();
    }
    return false;
  }

  const url = new URL(window.location.href);
  const returnedFromBridge = url.searchParams.get(LEGACY_IMPORT_QUERY_FLAG) === '1'
    && url.searchParams.get(LEGACY_IMPORT_UID_PARAM) === uid;

  if (returnedFromBridge) {
    const payload = tryReadImportedPayloadFromWindowName(uid);
    stripImportQueryParams();

    const identity = normalizeImportedIdentity(payload?.identity, uid);
    if (!identity) return false;

    const sessions = normalizeImportedSessions(payload?.sessions, uid);
    await secureKeyStore.saveIdentity(uid, identity);
    await Promise.all(sessions.map((record) => sessionStore.save(uid, record)));
    markLegacyImportSuccessful(uid);
    return true;
  }

  if (wasLegacyImportSuccessful(uid) || wasLegacyImportAttempted(uid)) return false;

  markLegacyImportAttempted(uid);

  try {
    await requestLegacyE2EEExport(uid);
    return false;
  } catch (error) {
    console.warn('[Pulse] Legacy E2EE import mislukt:', error?.message || error);
    return false;
  }
}
