import {
  PULSE_GROUP_E2EE_PROTOCOL,
  PULSE_GROUP_E2EE_VERSION,
  validateGroupMessageSend,
  validateGroupSenderKeyDistribution,
} from './groupProtocolContract';

const DISTRIBUTION_ID = '9b3553e9-bbe6-4938-beb5-5cb740412fd0';
const CLIENT_MESSAGE_ID = '123e4567-e89b-42d3-a456-426614174000';
const context = {
  authenticatedDeviceId: 'device-a1',
  isGroup: true,
  currentEpoch: 3,
  expectedRecipientDevices: [
    { userId: 'user-a', deviceId: 'device-a2' },
    { userId: 'user-b', deviceId: 'device-b1' },
  ],
};

function senderFields() {
  return {
    protocol: PULSE_GROUP_E2EE_PROTOCOL,
    protocolVersion: PULSE_GROUP_E2EE_VERSION,
    conversationId: 'group-1',
    senderDeviceId: 'device-a1',
    senderSignalDeviceId: 1,
    senderIdentityVersion: 2,
    epoch: 3,
    distributionId: DISTRIBUTION_ID,
  };
}

describe('group E2EE message contract', () => {
  test('accepts sender-key ciphertext bound to the active group epoch', () => {
    expect(validateGroupMessageSend({
      ...senderFields(),
      clientMessageId: CLIENT_MESSAGE_ID,
      messageType: 'text',
      ciphertext: 'ZW5jcnlwdGVk',
    }, context)).toEqual({ ok: true, errors: [] });
  });

  test.each([
    ['plaintext', { text: 'geheim' }, 'unknown_field'],
    ['old epoch', { epoch: 2 }, 'group_epoch_mismatch'],
    ['other device', { senderDeviceId: 'device-attacker' }, 'sender_device_mismatch'],
    ['attachment', { messageType: 'attachment' }, 'unsupported_message_type'],
  ])('rejects %s', (_label, override, code) => {
    const result = validateGroupMessageSend({
      ...senderFields(),
      clientMessageId: CLIENT_MESSAGE_ID,
      messageType: 'text',
      ciphertext: 'ZW5jcnlwdGVk',
      ...override,
    }, context);
    expect(result.errors.map((item) => item.code)).toContain(code);
  });
});

describe('group Sender Key distribution contract', () => {
  test('requires one pairwise-encrypted distribution per target device', () => {
    expect(validateGroupSenderKeyDistribution({
      ...senderFields(),
      recipientEnvelopes: [
        {
          recipientUserId: 'user-a',
          recipientDeviceId: 'device-a2',
          envelopeType: 'message',
          ciphertext: 'ZW5jcnlwdGVk',
        },
        {
          recipientUserId: 'user-b',
          recipientDeviceId: 'device-b1',
          envelopeType: 'prekey',
          ciphertext: 'ZW5jcnlwdGVk',
        },
      ],
    }, context)).toEqual({ ok: true, errors: [] });
  });

  test('rejects missing, duplicate and unexpected target devices', () => {
    const result = validateGroupSenderKeyDistribution({
      ...senderFields(),
      recipientEnvelopes: [
        {
          recipientUserId: 'user-b',
          recipientDeviceId: 'device-b1',
          envelopeType: 'prekey',
          ciphertext: 'ZW5jcnlwdGVk',
        },
        {
          recipientUserId: 'user-b',
          recipientDeviceId: 'device-b1',
          envelopeType: 'prekey',
          ciphertext: 'ZW5jcnlwdGVk',
        },
        {
          recipientUserId: 'user-c',
          recipientDeviceId: 'device-c1',
          envelopeType: 'prekey',
          ciphertext: 'ZW5jcnlwdGVk',
        },
      ],
    }, context);
    expect(result.errors.map((item) => item.code)).toEqual(expect.arrayContaining([
      'missing_recipient',
      'duplicate_recipient',
      'unexpected_recipient',
    ]));
  });
});
