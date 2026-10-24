import { V2ContractValidationError } from './protocolV2Contract';
import { V2ApiError, createV2ApiClient } from './v2ApiClient';

const USER = { uid: 'user-a', getIdToken: jest.fn().mockResolvedValue('id-token') };
const UUID = '123e4567-e89b-42d3-a456-426614174000';
const KEY = 'AQIDBA==';

function response(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(payload),
  };
}

function registration() {
  return {
    deviceId: 'device-a1',
    signalDeviceId: 1,
    deviceLabel: 'Tablet',
    platform: 'android',
    capabilities: { messageEncryption: true, hardwareBackedKeystore: true },
    registrationId: 42,
    identityKey: KEY,
    signedPreKey: { keyId: 7, publicKey: KEY, signature: KEY },
    kyberPreKey: { keyId: 8, publicKey: KEY, signature: KEY },
    oneTimePreKeys: [{ keyId: 9, publicKey: KEY }],
  };
}

function claim(recipientUserId = 'user-b', devices = [{
  deviceId: 'device-b1',
  signalDeviceId: 2,
  registrationId: 43,
  identityKey: KEY,
  identityVersion: 1,
  signedPreKey: { keyId: 10, publicKey: KEY, signature: KEY },
  kyberPreKey: { keyId: 11, publicKey: KEY, signature: KEY },
  oneTimePreKey: { keyId: 12, publicKey: KEY },
}]) {
  return {
    protocol: 'pulse_e2ee_v2',
    protocolVersion: 2,
    conversationId: 'conversation-1',
    recipientUserId,
    claimedAt: '2026-10-17T12:00:00.000Z',
    devices,
  };
}

describe('E2EE v2 API client', () => {
  let fetchImpl;
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    USER.getIdToken.mockResolvedValue('id-token');
    fetchImpl = jest.fn();
    client = createV2ApiClient({ baseUrl: 'https://api.pulse.test/', fetchImpl });
  });

  test('validates and registers public Android device material', async () => {
    fetchImpl.mockResolvedValue(response({
      ok: true,
      status: 'REGISTERED',
      deviceId: 'device-a1',
      identityVersion: 1,
    }, { status: 201 }));

    await client.registerDevice(USER, registration());

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.pulse.test/v2/devices/register',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer id-token' }),
        body: expect.stringContaining('"protocol":"pulse_e2ee_v2"'),
      }),
    );
    expect(fetchImpl.mock.calls[0][1].body).not.toContain('privateKey');
  });

  test('does not send invalid registration material', async () => {
    await expect(client.registerDevice(USER, {
      ...registration(),
      identityKey: 'private plaintext',
    })).rejects.toBeInstanceOf(V2ContractValidationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('preserves stable backend error codes without logging payloads', async () => {
    fetchImpl.mockResolvedValue(response(
      { error: 'v2_not_enabled' },
      { ok: false, status: 503 },
    ));

    await expect(client.listDevices(USER)).rejects.toEqual(expect.objectContaining({
      name: 'V2ApiError',
      code: 'v2_not_enabled',
      status: 503,
    }));
  });

  test('validates production pilot enrollment before device bootstrap', async () => {
    fetchImpl.mockResolvedValue(response({
      enabled: true,
      enrolled: true,
      mode: 'pilot',
      sendingEnabled: false,
    }));

    await expect(client.getPilotStatus(USER)).resolves.toEqual({
      enabled: true,
      enrolled: true,
      mode: 'pilot',
      sendingEnabled: false,
    });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.pulse.test/v2/pilot/status');

    fetchImpl.mockResolvedValueOnce(response({ enabled: true, enrolled: true }));
    await expect(client.getPilotStatus(USER)).rejects.toMatchObject({
      code: 'v2_pilot_status_invalid',
    });
  });

  test('accepts bounded internal Play test enrollment', async () => {
    fetchImpl.mockResolvedValue(response({
      enabled: true,
      enrolled: true,
      mode: 'internal_play_test',
      sendingEnabled: false,
    }));

    await expect(client.getPilotStatus(USER)).resolves.toEqual({
      enabled: true,
      enrolled: true,
      mode: 'internal_play_test',
      sendingEnabled: false,
    });
  });

  test('claims and validates recipient bundles', async () => {
    fetchImpl.mockResolvedValue(response(claim()));

    await expect(client.claimRecipientBundles(USER, {
      conversationId: 'conversation-1',
      recipientUserId: 'user-b',
      requesterDeviceId: 'device-a1',
      claimId: UUID,
    })).resolves.toMatchObject({ recipientUserId: 'user-b' });

    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://api.pulse.test/v2/conversations/conversation-1/users/user-b/key-bundles/claim',
    );
  });

  test('rejects invalid route identifiers before authentication or network access', async () => {
    await expect(client.claimRecipientBundles(USER, {
      conversationId: '../conversation',
      recipientUserId: 'user-b',
      requesterDeviceId: 'device-a1',
      claimId: UUID,
    })).rejects.toMatchObject({ code: 'v2_client_id_invalid' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('accepts an empty authoritative own-device claim', async () => {
    fetchImpl.mockResolvedValue(response(claim('user-a', [])));

    await expect(client.claimOwnDeviceBundles(USER, {
      conversationId: 'conversation-1',
      requesterDeviceId: 'device-a1',
      claimId: UUID,
    })).resolves.toMatchObject({ devices: [] });
  });

  test('rejects malformed claim responses before crypto sees them', async () => {
    fetchImpl.mockResolvedValue(response({ ...claim(), protocolVersion: 1 }));

    await expect(client.claimRecipientBundles(USER, {
      conversationId: 'conversation-1',
      recipientUserId: 'user-b',
      requesterDeviceId: 'device-a1',
      claimId: UUID,
    })).rejects.toBeInstanceOf(V2ContractValidationError);
  });

  test('validates the exact recipient set before sending ciphertext', async () => {
    fetchImpl.mockResolvedValue(response({ ok: true, messageId: UUID }));
    const message = {
      conversationId: 'conversation-1',
      clientMessageId: UUID,
      senderDeviceId: 'device-a1',
      messageType: 'text',
      recipientEnvelopes: [{
        recipientUserId: 'user-b',
        recipientDeviceId: 'device-b1',
        envelopeType: 'prekey',
        ciphertext: 'ZW5jcnlwdGVk',
      }],
    };

    await client.sendMessage(USER, message, [{ userId: 'user-b', deviceId: 'device-b1' }]);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.pulse.test/v2/messages/send');

    await expect(client.sendMessage(USER, message, [
      { userId: 'user-b', deviceId: 'device-b1' },
      { userId: 'user-b', deviceId: 'device-b2' },
    ])).rejects.toBeInstanceOf(V2ContractValidationError);
  });

  test('validates fetched envelope ownership', async () => {
    fetchImpl.mockResolvedValue(response({
      protocol: 'pulse_e2ee_v2',
      protocolVersion: 2,
      messageId: 'message-1',
      conversationId: 'conversation-1',
      clientMessageId: UUID,
      senderUserId: 'user-b',
      senderDeviceId: 'device-b1',
      senderSignalDeviceId: 2,
      senderIdentityVersion: 1,
      recipientUserId: 'user-a',
      recipientDeviceId: 'device-a1',
      messageType: 'text',
      envelopeType: 'prekey',
      ciphertext: 'ZW5jcnlwdGVk',
      createdAt: '2026-10-17T12:00:00.000Z',
    }));

    await expect(client.fetchEnvelope(USER, {
      conversationId: 'conversation-1',
      messageId: 'message-1',
      deviceId: 'device-a1',
    })).resolves.toMatchObject({ recipientDeviceId: 'device-a1' });
  });

  test('lists only message descriptors for the requested device feed', async () => {
    fetchImpl.mockResolvedValue(response({
      messages: [{
        protocol: 'pulse_e2ee_v2',
        protocolVersion: 2,
        conversationId: 'conversation-1',
        messageId: 'message-1',
        createdAt: '2026-10-17T12:00:00.000Z',
      }],
    }));

    await expect(client.listMessageFeed(USER, {
      conversationId: 'conversation-1',
      deviceId: 'device-a1',
      limit: 30,
      offset: 0,
    })).resolves.toHaveLength(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://api.pulse.test/v2/conversations/conversation-1/messages?deviceId=device-a1&limit=30&offset=0',
    );
  });

  test('acknowledges a decrypted device envelope without plaintext', async () => {
    fetchImpl.mockResolvedValue(response({ ok: true, idempotent: false }));

    await client.acknowledgeMessage(USER, {
      conversationId: 'conversation-1',
      messageId: 'message-1',
      deviceId: 'device-a1',
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.pulse.test/v2/conversations/conversation-1/messages/message-1/ack',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ deviceId: 'device-a1' }),
      }),
    );
  });
});

test('V2ApiError has a stable fallback code', () => {
  expect(new V2ApiError()).toMatchObject({ code: 'v2_request_failed', status: 0 });
});
