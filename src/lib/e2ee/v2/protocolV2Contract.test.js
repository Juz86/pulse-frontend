import {
  PULSE_E2EE_V2_PROTOCOL,
  PULSE_E2EE_V2_VERSION,
  V2ContractValidationError,
  assertValidV2MessageSend,
  validateV2DeviceRegistration,
  validateV2KeyBundleClaim,
  validateV2KeyBundleClaimRequest,
  validateV2MessageDelivery,
  validateV2MessageSend,
} from './protocolV2Contract';

const VALID_UUID = '123e4567-e89b-42d3-a456-426614174000';
const BASE64_KEY = 'AQIDBA==';

function validEnvelope(overrides = {}) {
  return {
    recipientUserId: 'user-b',
    recipientDeviceId: 'device-b1',
    envelopeType: 'prekey',
    ciphertext: 'ZW5jcnlwdGVk',
    ...overrides,
  };
}

function validMessage(overrides = {}) {
  return {
    protocol: PULSE_E2EE_V2_PROTOCOL,
    protocolVersion: PULSE_E2EE_V2_VERSION,
    conversationId: 'conversation-1',
    clientMessageId: VALID_UUID,
    senderDeviceId: 'device-a1',
    messageType: 'text',
    recipientEnvelopes: [validEnvelope()],
    ...overrides,
  };
}

function messageContext(overrides = {}) {
  return {
    authenticatedDeviceId: 'device-a1',
    expectedRecipientDevices: [{ userId: 'user-b', deviceId: 'device-b1' }],
    ...overrides,
  };
}

function validRegistration(overrides = {}) {
  return {
    protocol: PULSE_E2EE_V2_PROTOCOL,
    protocolVersion: PULSE_E2EE_V2_VERSION,
    deviceId: 'device-a1',
    signalDeviceId: 1,
    deviceLabel: 'Tablet',
    platform: 'android',
    capabilities: {
      messageEncryption: true,
      hardwareBackedKeystore: true,
    },
    registrationId: 42,
    identityKey: BASE64_KEY,
    signedPreKey: {
      keyId: 7,
      publicKey: BASE64_KEY,
      signature: BASE64_KEY,
    },
    kyberPreKey: {
      keyId: 11,
      publicKey: BASE64_KEY,
      signature: BASE64_KEY,
    },
    oneTimePreKeys: [{ keyId: 8, publicKey: BASE64_KEY }],
    ...overrides,
  };
}

function errorCodes(result) {
  return result.errors.map((error) => error.code);
}

function validClaim(overrides = {}) {
  return {
    protocol: PULSE_E2EE_V2_PROTOCOL,
    protocolVersion: PULSE_E2EE_V2_VERSION,
    conversationId: 'conversation-1',
    recipientUserId: 'user-b',
    claimedAt: '2026-10-16T20:30:00.000Z',
    devices: [{
      deviceId: 'device-b1',
      signalDeviceId: 2,
      registrationId: 43,
      identityKey: BASE64_KEY,
      identityVersion: 1,
      signedPreKey: {
        keyId: 9,
        publicKey: BASE64_KEY,
        signature: BASE64_KEY,
      },
      kyberPreKey: {
        keyId: 12,
        publicKey: BASE64_KEY,
        signature: BASE64_KEY,
      },
      oneTimePreKey: { keyId: 10, publicKey: BASE64_KEY },
    }],
    ...overrides,
  };
}

function claimContext(overrides = {}) {
  return {
    authorized: true,
    expectedRecipientUserId: 'user-b',
    expectedRecipientDeviceIds: ['device-b1'],
    ...overrides,
  };
}

function validDelivery(overrides = {}) {
  return {
    protocol: PULSE_E2EE_V2_PROTOCOL,
    protocolVersion: PULSE_E2EE_V2_VERSION,
    messageId: 'message-1',
    conversationId: 'conversation-1',
    clientMessageId: VALID_UUID,
    senderUserId: 'user-a',
    senderDeviceId: 'device-a1',
    senderSignalDeviceId: 1,
    senderIdentityVersion: 1,
    recipientUserId: 'user-b',
    recipientDeviceId: 'device-b1',
    messageType: 'text',
    envelopeType: 'prekey',
    ciphertext: 'ZW5jcnlwdGVk',
    createdAt: '2026-10-16T20:31:00.000Z',
    ...overrides,
  };
}

describe('pulse_e2ee_v2 message send contract', () => {
  test('accepts the exact phase-one per-device envelope contract', () => {
    expect(validateV2MessageSend(validMessage(), messageContext())).toEqual({
      ok: true,
      errors: [],
    });
  });

  test.each([
    ['legacy protocol', { protocol: 'signal_v1' }, 'invalid_protocol'],
    ['wrong protocol version', { protocolVersion: 1 }, 'invalid_protocol_version'],
    ['non-UUID client id', { clientMessageId: 'local-123' }, 'invalid_uuid'],
    ['unsupported message type', { messageType: 'attachment' }, 'unsupported_message_type'],
    ['empty envelopes', { recipientEnvelopes: [] }, 'invalid_recipient_count'],
  ])('rejects %s', (_label, overrides, expectedCode) => {
    expect(errorCodes(validateV2MessageSend(
      validMessage(overrides),
      messageContext()
    ))).toContain(expectedCode);
  });

  test.each(['text', 'plaintext', 'preview', 'messageKey'])('rejects leaked %s fields', (field) => {
    const result = validateV2MessageSend(
      validMessage({ [field]: 'niet toegestaan' }),
      messageContext()
    );

    expect(result.errors).toContainEqual({ code: 'unknown_field', path: `$.${field}` });
  });

  test('rejects a sender device that differs from the authenticated device', () => {
    const result = validateV2MessageSend(validMessage(), messageContext({
      authenticatedDeviceId: 'device-attacker',
    }));

    expect(errorCodes(result)).toContain('sender_device_mismatch');
  });

  test('requires authoritative recipient context from the backend', () => {
    const result = validateV2MessageSend(validMessage(), {
      authenticatedDeviceId: 'device-a1',
    });

    expect(errorCodes(result)).toContain('recipient_context_required');
  });

  test('rejects duplicate recipient devices', () => {
    const duplicate = validEnvelope();
    const result = validateV2MessageSend(validMessage({
      recipientEnvelopes: [validEnvelope(), duplicate],
    }), messageContext());

    expect(errorCodes(result)).toContain('duplicate_recipient');
  });

  test('rejects a missing active recipient device', () => {
    const result = validateV2MessageSend(validMessage(), messageContext({
      expectedRecipientDevices: [
        { userId: 'user-b', deviceId: 'device-b1' },
        { userId: 'user-b', deviceId: 'device-b2' },
      ],
    }));

    expect(errorCodes(result)).toContain('missing_recipient');
  });

  test('rejects an envelope for a device outside the authoritative recipient set', () => {
    const result = validateV2MessageSend(validMessage({
      recipientEnvelopes: [validEnvelope({ recipientDeviceId: 'device-attacker' })],
    }), messageContext());

    expect(errorCodes(result)).toEqual(expect.arrayContaining([
      'missing_recipient',
      'unexpected_recipient',
    ]));
  });

  test.each([
    ['invalid envelope type', { envelopeType: 'plaintext' }, 'unsupported_envelope_type'],
    ['invalid ciphertext', { ciphertext: 'dit is geen base64' }, 'invalid_base64'],
    ['plaintext inside envelope', { text: 'geheim' }, 'unknown_field'],
  ])('rejects %s', (_label, envelopeOverrides, expectedCode) => {
    const result = validateV2MessageSend(validMessage({
      recipientEnvelopes: [validEnvelope(envelopeOverrides)],
    }), messageContext());

    expect(errorCodes(result)).toContain(expectedCode);
  });

  test('throws a typed error when assertion validation fails', () => {
    expect(() => assertValidV2MessageSend(
      validMessage({ protocol: 'signal_v1' }),
      messageContext()
    )).toThrow(V2ContractValidationError);
  });
});

describe('pulse_e2ee_v2 device registration contract', () => {
  test('accepts a complete Android registration', () => {
    expect(validateV2DeviceRegistration(validRegistration())).toEqual({
      ok: true,
      errors: [],
    });
  });

  test.each([
    ['legacy protocol', { protocol: 'signal_v1' }, 'invalid_protocol'],
    ['unsupported platform', { platform: 'node' }, 'unsupported_platform'],
    ['invalid Signal device id', { signalDeviceId: 128 }, 'invalid_signal_device_id'],
    ['missing encryption capability', {
      capabilities: { messageEncryption: false, hardwareBackedKeystore: false },
    }, 'required_capability_missing'],
    ['invalid identity key', { identityKey: 'not base64' }, 'invalid_base64'],
    ['invalid Kyber prekey', {
      kyberPreKey: { keyId: 11, publicKey: 'not base64', signature: BASE64_KEY },
    }, 'invalid_base64'],
    ['no one-time prekeys', { oneTimePreKeys: [] }, 'invalid_prekey_count'],
  ])('rejects %s', (_label, overrides, expectedCode) => {
    expect(errorCodes(validateV2DeviceRegistration(
      validRegistration(overrides)
    ))).toContain(expectedCode);
  });

  test('rejects duplicate one-time prekey ids', () => {
    const result = validateV2DeviceRegistration(validRegistration({
      oneTimePreKeys: [
        { keyId: 8, publicKey: BASE64_KEY },
        { keyId: 8, publicKey: BASE64_KEY },
      ],
    }));

    expect(errorCodes(result)).toContain('duplicate_prekey_id');
  });

  test.each(['privateKey', 'identityPrivateKey', 'sessionRecord'])('rejects private %s material', (field) => {
    const result = validateV2DeviceRegistration(validRegistration({
      [field]: BASE64_KEY,
    }));

    expect(result.errors).toContainEqual({ code: 'unknown_field', path: `$.${field}` });
  });
});

describe('pulse_e2ee_v2 key-bundle claim contract', () => {
  test('accepts an idempotent claim request bound to the authenticated device', () => {
    expect(validateV2KeyBundleClaimRequest({
      protocol: PULSE_E2EE_V2_PROTOCOL,
      protocolVersion: PULSE_E2EE_V2_VERSION,
      requesterDeviceId: 'device-a1',
      claimId: VALID_UUID,
    }, { authenticatedDeviceId: 'device-a1' })).toEqual({ ok: true, errors: [] });
  });

  test('rejects a claim request for another device or malformed claim id', () => {
    const result = validateV2KeyBundleClaimRequest({
      protocol: PULSE_E2EE_V2_PROTOCOL,
      protocolVersion: PULSE_E2EE_V2_VERSION,
      requesterDeviceId: 'device-attacker',
      claimId: 'retry-me',
    }, { authenticatedDeviceId: 'device-a1' });

    expect(errorCodes(result)).toEqual(expect.arrayContaining([
      'sender_device_mismatch',
      'invalid_uuid',
    ]));
  });

  test('accepts an authorized claim with one prekey per expected device', () => {
    expect(validateV2KeyBundleClaim(validClaim(), claimContext())).toEqual({
      ok: true,
      errors: [],
    });
  });

  test('accepts an empty own-device claim when no sibling device exists', () => {
    expect(validateV2KeyBundleClaim(validClaim({
      recipientUserId: 'user-a',
      devices: [],
    }), {
      authorized: true,
      expectedRecipientUserId: 'user-a',
      expectedRecipientDeviceIds: [],
      allowEmptyDevices: true,
    })).toEqual({ ok: true, errors: [] });
  });

  test.each([
    ['unauthorized claim', claimContext({ authorized: false }), 'claim_not_authorized'],
    ['wrong recipient', claimContext({ expectedRecipientUserId: 'user-c' }), 'recipient_user_mismatch'],
    ['missing device context', { authorized: true, expectedRecipientUserId: 'user-b' }, 'claim_device_context_required'],
  ])('rejects %s', (_label, context, expectedCode) => {
    expect(errorCodes(validateV2KeyBundleClaim(validClaim(), context))).toContain(expectedCode);
  });

  test('rejects a claim response without a one-time prekey', () => {
    const device = validClaim().devices[0];
    const result = validateV2KeyBundleClaim(validClaim({
      devices: [{
        deviceId: device.deviceId,
        registrationId: device.registrationId,
        identityKey: device.identityKey,
        signedPreKey: device.signedPreKey,
      }],
    }), claimContext());

    expect(result.errors).toContainEqual({
      code: 'required',
      path: '$.devices[0].oneTimePreKey',
    });
  });

  test('rejects missing and unexpected claimed devices', () => {
    const result = validateV2KeyBundleClaim(validClaim(), claimContext({
      expectedRecipientDeviceIds: ['device-b2'],
    }));

    expect(errorCodes(result)).toEqual(expect.arrayContaining([
      'missing_claimed_device',
      'unexpected_claimed_device',
    ]));
  });

  test('rejects duplicate claimed devices', () => {
    const device = validClaim().devices[0];
    const result = validateV2KeyBundleClaim(validClaim({
      devices: [device, { ...device }],
    }), claimContext());

    expect(errorCodes(result)).toContain('duplicate_claimed_device');
  });
});

describe('pulse_e2ee_v2 message delivery contract', () => {
  test('accepts an envelope addressed to the authenticated user and device', () => {
    expect(validateV2MessageDelivery(validDelivery(), {
      authenticatedUserId: 'user-b',
      authenticatedDeviceId: 'device-b1',
    })).toEqual({ ok: true, errors: [] });
  });

  test.each([
    ['wrong user', { authenticatedUserId: 'user-c', authenticatedDeviceId: 'device-b1' }, 'recipient_user_mismatch'],
    ['wrong device', { authenticatedUserId: 'user-b', authenticatedDeviceId: 'device-b2' }, 'recipient_device_mismatch'],
  ])('rejects delivery to the %s', (_label, context, expectedCode) => {
    expect(errorCodes(validateV2MessageDelivery(validDelivery(), context))).toContain(expectedCode);
  });

  test.each(['text', 'plaintext', 'preview', 'messageKey'])('rejects leaked delivery %s fields', (field) => {
    const result = validateV2MessageDelivery(validDelivery({ [field]: 'geheim' }), {
      authenticatedUserId: 'user-b',
      authenticatedDeviceId: 'device-b1',
    });

    expect(result.errors).toContainEqual({ code: 'unknown_field', path: `$.${field}` });
  });

  test('rejects malformed delivery metadata and ciphertext', () => {
    const result = validateV2MessageDelivery(validDelivery({
      createdAt: 'morgen',
      ciphertext: 'niet-versleuteld',
    }), {
      authenticatedUserId: 'user-b',
      authenticatedDeviceId: 'device-b1',
    });

    expect(errorCodes(result)).toEqual(expect.arrayContaining([
      'invalid_iso_date',
      'invalid_base64',
    ]));
  });
});
