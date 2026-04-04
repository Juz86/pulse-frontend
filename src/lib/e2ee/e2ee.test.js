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
import {
  MAX_E2EE_ATTACHMENT_BYTES,
  isImageAttachment,
  normalizeAttachmentPayload,
  resolveAttachmentUrl,
  validateAttachmentPayload,
} from './attachmentPayload';
import {
  buildMockRemoteAttachmentPayload,
  prepareAttachmentForSend,
} from './attachmentUploadAdapter';
import {
  getAttachmentAccessInfo,
  openAttachmentInNewTab,
  triggerAttachmentDownload,
} from './attachmentAccessAdapter';

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

  test('normalizeIncomingMessage preserves structured attachment metadata', () => {
    const normalized = normalizeIncomingMessage(
      {
        id: 'msg-attachment-1',
        conversationId: 'conv-1',
        senderUserId: 'user-2',
        type: 'attachment',
        messageType: 'attachment',
        text: 'document.pdf',
        attachment: { name: 'document.pdf', url: 'https://example.com/document.pdf', mimeType: 'application/pdf' },
      },
      'user-1'
    );

    expect(normalized.type).toBe('attachment');
    expect(normalized.attachment?.name).toBe('document.pdf');
  });

  test('normalizeIncomingMessage preserves reaction objects', () => {
    const normalized = normalizeIncomingMessage(
      {
        id: 'msg-2',
        conversationId: 'conv-1',
        senderUserId: 'user-2',
        reactions: { '❤️': ['user-1', 'user-2'] },
      },
      'user-1'
    );

    expect(normalized.reactions['❤️']).toEqual(['user-1', 'user-2']);
  });

  test('normalizeIncomingMessage preserves mentions', () => {
    const normalized = normalizeIncomingMessage(
      {
        id: 'msg-3',
        conversationId: 'conv-1',
        senderUserId: 'user-2',
        mentions: ['user-1', 'user-4'],
      },
      'user-1'
    );

    expect(normalized.mentions).toEqual(['user-1', 'user-4']);
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

describe('e2ee attachment helpers', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('normalizeAttachmentPayload sanitizes missing fields', () => {
    expect(normalizeAttachmentPayload({ url: 'data:text/plain;base64,SGVsbG8=' })).toEqual({
      name: 'Bestand',
      url: 'data:text/plain;base64,SGVsbG8=',
      downloadUrl: '',
      thumbnailUrl: '',
      storageKey: '',
      transfer: 'inline',
      mimeType: '',
      size: null,
      caption: '',
      encryption: null,
    });
  });

  test('normalizeAttachmentPayload keeps remote metadata for future encrypted storage', () => {
    expect(normalizeAttachmentPayload({
      name: 'foto.jpg',
      downloadUrl: 'https://cdn.example.com/foto.jpg',
      thumbnailUrl: 'https://cdn.example.com/foto-thumb.jpg',
      storageKey: 'attachments/conv-1/foto.jpg',
      mimeType: 'image/jpeg',
      transfer: 'remote',
      encryption: {
        alg: 'aes-gcm',
        keyId: 'key-1',
        iv: 'iv-1',
        sha256: 'hash-1',
      },
    })).toEqual({
      name: 'foto.jpg',
      url: '',
      downloadUrl: 'https://cdn.example.com/foto.jpg',
      thumbnailUrl: 'https://cdn.example.com/foto-thumb.jpg',
      storageKey: 'attachments/conv-1/foto.jpg',
      transfer: 'remote',
      mimeType: 'image/jpeg',
      size: null,
      caption: '',
      encryption: {
        alg: 'aes-gcm',
        keyId: 'key-1',
        iv: 'iv-1',
        sha256: 'hash-1',
      },
    });
  });

  test('validateAttachmentPayload rejects oversized payloads', () => {
    const attachment = normalizeAttachmentPayload({
      name: 'grote-bijlage.pdf',
      url: 'https://example.com/large.pdf',
      size: MAX_E2EE_ATTACHMENT_BYTES + 1,
    });

    expect(validateAttachmentPayload(attachment)).toBe('Bijlagen mogen lokaal maximaal 2 MB zijn in deze testfase.');
  });

  test('isImageAttachment recognizes mime type and data urls', () => {
    expect(isImageAttachment({ mimeType: 'image/png', url: 'https://example.com/image.png' })).toBe(true);
    expect(isImageAttachment({ mimeType: 'application/pdf', url: 'data:image/png;base64,abc' })).toBe(true);
    expect(isImageAttachment({ mimeType: 'application/pdf', url: 'https://example.com/file.pdf' })).toBe(false);
  });

  test('resolveAttachmentUrl prefers remote download urls', () => {
    expect(resolveAttachmentUrl({
      url: 'data:image/png;base64,abc',
      downloadUrl: 'https://cdn.example.com/image.png',
    })).toBe('https://cdn.example.com/image.png');
  });

  test('buildMockRemoteAttachmentPayload creates future-proof remote metadata', () => {
    const attachment = buildMockRemoteAttachmentPayload({
      name: 'foto.png',
      url: 'data:image/png;base64,abc',
      mimeType: 'image/png',
      size: 1234,
    }, {
      conversationId: 'conv-1',
      userId: 'user-1',
    });

    expect(attachment.transfer).toBe('remote');
    expect(attachment.downloadUrl).toBe('data:image/png;base64,abc');
    expect(attachment.thumbnailUrl).toBe('data:image/png;base64,abc');
    expect(attachment.storageKey).toContain('mock-e2ee/conv-1/user-1/');
    expect(attachment.encryption?.alg).toBe('mock-e2ee-envelope');
  });

  test('prepareAttachmentForSend supports remote_mock mode', async () => {
    const attachment = await prepareAttachmentForSend({
      attachment: {
        name: 'document.pdf',
        url: 'data:application/pdf;base64,abc',
        mimeType: 'application/pdf',
        size: 456,
      },
      conversationId: 'conv-2',
      userId: 'user-9',
      transportMode: 'remote_mock',
      uploadAttachment: async (payload) => ({
        ...payload,
        downloadUrl: 'https://cdn.example.com/document.pdf',
        storageKey: 'mock-e2ee/conv-2/user-9/document.pdf',
      }),
    });

    expect(attachment.transfer).toBe('remote');
    expect(attachment.downloadUrl).toBe('https://cdn.example.com/document.pdf');
    expect(attachment.storageKey).toBe('mock-e2ee/conv-2/user-9/document.pdf');
  });

  test('prepareAttachmentForSend uploads through backend when no custom uploader is provided', async () => {
    const getIdToken = jest.fn().mockResolvedValue('token-123');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        attachment: {
          name: 'foto.png',
          downloadUrl: 'http://localhost:3001/attachments/mock-1',
          thumbnailUrl: 'http://localhost:3001/attachments/mock-1',
          storageKey: 'mock-storage/mock-1/foto.png',
          transfer: 'remote',
          mimeType: 'image/png',
          size: 321,
          caption: 'Test',
          encryption: {
            alg: 'mock-storage-envelope',
            keyId: 'mock-key-mock-1',
            iv: 'mock-iv-mock-1',
            sha256: 'mock-sha256-321',
          },
        },
      }),
    });

    const attachment = await prepareAttachmentForSend({
      attachment: {
        name: 'foto.png',
        url: 'data:image/png;base64,abc',
        mimeType: 'image/png',
        size: 321,
        caption: 'Test',
      },
      conversationId: 'conv-5',
      userId: 'user-5',
      user: { getIdToken },
      transportMode: 'remote_mock',
    });

    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toContain('/api/attachments/upload');
    expect(attachment.transfer).toBe('remote');
    expect(attachment.downloadUrl).toBe('http://localhost:3001/attachments/mock-1');
  });

  test('getAttachmentAccessInfo exposes future decrypt-related access hints', () => {
    const info = getAttachmentAccessInfo({
      transfer: 'remote',
      downloadUrl: 'https://cdn.example.com/foto.png',
      mimeType: 'image/png',
      encryption: {
        alg: 'mock-storage-envelope',
        keyId: 'key-1',
      },
    });

    expect(info.url).toBe('https://cdn.example.com/foto.png');
    expect(info.canOpen).toBe(true);
    expect(info.canDownload).toBe(true);
    expect(info.isImage).toBe(true);
    expect(info.needsRemoteFetch).toBe(true);
  });

  test('openAttachmentInNewTab uses provided opener', () => {
    const opener = jest.fn();
    const opened = openAttachmentInNewTab({
      downloadUrl: 'https://cdn.example.com/file.pdf',
    }, opener);

    expect(opened).toBe(true);
    expect(opener).toHaveBeenCalledWith('https://cdn.example.com/file.pdf', '_blank', 'noopener,noreferrer');
  });

  test('triggerAttachmentDownload creates a downloadable link', () => {
    const click = jest.fn();
    const remove = jest.fn();
    const appendChild = jest.fn();
    const createElement = jest.fn(() => ({
      click,
      remove,
      href: '',
      download: '',
      rel: '',
    }));
    const doc = {
      createElement,
      body: { appendChild },
    };

    const downloaded = triggerAttachmentDownload({
      name: 'rapport.pdf',
      downloadUrl: 'https://cdn.example.com/rapport.pdf',
    }, doc);

    expect(downloaded).toBe(true);
    expect(createElement).toHaveBeenCalledWith('a');
    expect(appendChild).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
  });
});
