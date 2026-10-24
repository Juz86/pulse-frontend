import {
  PULSE_CALL_E2EE_PROTOCOL,
  PULSE_CALL_E2EE_VERSION,
  extractSha256FingerprintFromSdp,
  normalizeDtlsFingerprint,
  validateCallIdentityEnvelope,
} from './callIdentityContract';

const FINGERPRINT = 'ab'.repeat(32);
const base = {
  protocol: PULSE_CALL_E2EE_PROTOCOL,
  protocolVersion: PULSE_CALL_E2EE_VERSION,
  sessionId: 'call-1',
  callerUserId: 'alice',
  calleeUserId: 'bob',
  senderDeviceId: 'device-a1',
  senderSignalDeviceId: 1,
  senderIdentityVersion: 2,
  mediaType: 'video',
  descriptionType: 'offer',
  dtlsFingerprintSha256: FINGERPRINT,
  revision: 0,
  nonce: 'nonce-1',
  peerBindingHash: '',
  identityKey: 'aWRlbnRpdHk=',
  signature: 'c2lnbmF0dXJl',
};
const context = {
  sessionId: 'call-1',
  callerUserId: 'alice',
  calleeUserId: 'bob',
  authenticatedDeviceId: 'device-a1',
  senderIdentityVersion: 2,
  mediaType: 'video',
  descriptionType: 'offer',
};

describe('call identity contract', () => {
  test('accepts a signed offer bound to the authoritative session and device', () => {
    expect(validateCallIdentityEnvelope(base, context)).toEqual({ ok: true, errors: [] });
  });

  test.each([
    ['session swap', { sessionId: 'call-2' }, 'session_mismatch'],
    ['device swap', { senderDeviceId: 'device-x' }, 'sender_device_mismatch'],
    ['identity rollback', { senderIdentityVersion: 1 }, 'identity_version_mismatch'],
    ['fingerprint mutation', { dtlsFingerprintSha256: 'not-a-hash' }, 'invalid_fingerprint'],
    ['plaintext field', { description: 'v=0' }, 'unknown_field'],
  ])('rejects %s', (_label, override, code) => {
    const result = validateCallIdentityEnvelope({ ...base, ...override }, context);
    expect(result.errors.map((item) => item.code)).toContain(code);
  });

  test('requires an answer to bind the signed offer', () => {
    const missing = validateCallIdentityEnvelope({
      ...base,
      senderDeviceId: 'device-b1',
      senderSignalDeviceId: 2,
      descriptionType: 'answer',
      peerBindingHash: '',
    }, {
      ...context,
      authenticatedDeviceId: 'device-b1',
      descriptionType: 'answer',
    });
    expect(missing.errors.map((item) => item.code)).toContain('peer_binding_hash_required');
  });
});

describe('DTLS fingerprint extraction', () => {
  test('normalizes the colon-separated WebRTC representation', () => {
    expect(normalizeDtlsFingerprint('AB:AB:AB:AB:AB:AB:AB:AB:AB:AB:AB:AB:AB:AB:AB:AB:AB:AB:AB:AB:AB:AB:AB:AB:AB:AB:AB:AB:AB:AB:AB:AB'))
      .toBe(FINGERPRINT);
  });

  test('extracts one consistent SHA-256 fingerprint from SDP', () => {
    const colonFingerprint = FINGERPRINT.match(/.{2}/g).join(':').toUpperCase();
    expect(extractSha256FingerprintFromSdp([
      'v=0',
      `a=fingerprint:sha-256 ${colonFingerprint}`,
      `a=fingerprint:sha-256 ${colonFingerprint}`,
    ].join('\r\n'))).toBe(FINGERPRINT);
  });

  test('rejects missing, weak or inconsistent fingerprints', () => {
    expect(extractSha256FingerprintFromSdp('v=0\r\na=fingerprint:sha-1 AA:BB')).toBeNull();
    expect(extractSha256FingerprintFromSdp([
      `a=fingerprint:sha-256 ${'aa'.repeat(32)}`,
      `a=fingerprint:sha-256 ${'bb'.repeat(32)}`,
    ].join('\r\n'))).toBeNull();
  });
});
