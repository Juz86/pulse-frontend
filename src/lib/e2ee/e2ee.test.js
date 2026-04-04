import {
  buildPendingMessage,
  getConversationPreview,
  getMessageDisplayText,
  normalizeIncomingMessage,
  patchPendingMessageAsFailed,
  patchPendingMessageAsSent,
} from './messageModel';
import {
  ENCRYPTED_EDIT_UNAVAILABLE_MESSAGE,
  canApplyPlaintextEditUpdate,
  canEditMessage,
  isEncryptedProtocol,
} from './policy';

describe('e2ee message model helpers', () => {
  test('normalizeIncomingMessage maps senderUserId to senderId and marks ownership', () => {
    const normalized = normalizeIncomingMessage(
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        senderUserId: 'user-1',
        ciphertext: 'abc',
        protocol: 'signal_v1',
      },
      'user-1'
    );

    expect(normalized.senderId).toBe('user-1');
    expect(normalized.isOwn).toBe(true);
    expect(normalized.ciphertextAvailable).toBe(true);
  });

  test('buildPendingMessage creates a sending signal_v1 message', () => {
    const pending = buildPendingMessage({
      text: 'Hallo',
      conversationId: 'conv-1',
      userId: 'user-1',
    });

    expect(pending.text).toBe('Hallo');
    expect(pending.protocol).toBe('signal_v1');
    expect(pending.deliveryState).toBe('sending');
    expect(pending.pending).toBe(true);
    expect(pending.failed).toBe(false);
  });

  test('patchPendingMessageAsSent marks a pending message as sent', () => {
    const pending = buildPendingMessage({
      text: 'Hallo',
      conversationId: 'conv-1',
      userId: 'user-1',
    });

    const sent = patchPendingMessageAsSent(pending, 'msg-2');

    expect(sent.id).toBe('msg-2');
    expect(sent.deliveryState).toBe('sent');
    expect(sent.pending).toBe(false);
    expect(sent.ciphertextAvailable).toBe(true);
  });

  test('patchPendingMessageAsFailed marks a pending message as failed', () => {
    const pending = buildPendingMessage({
      text: 'Hallo',
      conversationId: 'conv-1',
      userId: 'user-1',
    });

    const failed = patchPendingMessageAsFailed(pending);

    expect(failed.deliveryState).toBe('failed');
    expect(failed.pending).toBe(false);
    expect(failed.failed).toBe(true);
  });

  test('getConversationPreview falls back to encrypted placeholder', () => {
    expect(getConversationPreview({ ciphertextAvailable: true, decryptedLocally: false })).toBe('Versleuteld bericht');
  });

  test('contact messages keep their shared-contact preview', () => {
    expect(getConversationPreview({
      type: 'contact',
      sharedContact: { name: 'Habiba' },
    })).toBe('Contactpersoon: Habiba');
  });

  test('getMessageDisplayText falls back to encrypted placeholder when text is unavailable', () => {
    expect(getMessageDisplayText({ ciphertextAvailable: true, decryptedLocally: false })).toBe('Versleuteld bericht');
  });

  test('normalizeIncomingMessage preserves structured contact metadata', () => {
    const normalized = normalizeIncomingMessage(
      {
        id: 'msg-contact-1',
        conversationId: 'conv-1',
        senderUserId: 'user-2',
        type: 'contact',
        messageType: 'contact',
        text: 'Contactpersoon: Habiba',
        sharedContact: { uid: 'user-3', name: 'Habiba', email: 'habiba@example.com' },
      },
      'user-1'
    );

    expect(normalized.type).toBe('contact');
    expect(normalized.messageType).toBe('contact');
    expect(normalized.sharedContact?.name).toBe('Habiba');
  });
});

describe('e2ee policy helpers', () => {
  test('signal_v1 is treated as encrypted protocol', () => {
    expect(isEncryptedProtocol('signal_v1')).toBe(true);
    expect(isEncryptedProtocol('legacy_plaintext')).toBe(false);
  });

  test('encrypted messages cannot be edited or plaintext-updated', () => {
    const message = { protocol: 'signal_v1' };

    expect(canEditMessage(message)).toBe(false);
    expect(canApplyPlaintextEditUpdate(message)).toBe(false);
  });

  test('legacy messages can still be edited', () => {
    const message = { protocol: 'legacy_plaintext' };

    expect(canEditMessage(message)).toBe(true);
    expect(canApplyPlaintextEditUpdate(message)).toBe(true);
  });

  test('edit unavailable message stays stable', () => {
    expect(ENCRYPTED_EDIT_UNAVAILABLE_MESSAGE).toBe('Bewerken voor versleutelde berichten is nog niet beschikbaar.');
  });
});
