import {
  buildTextMessageCardPresentation,
  getMessageReceiptSummaryLabel,
  getMessageStatusInfo,
} from './messageBubbleHelpers';
import { buildMessageBubbleCard } from './messageBubbleCardHelpers';

describe('messageBubbleHelpers', () => {
  test('missed call cards invite the recipient to call back', () => {
    expect(buildMessageBubbleCard({
      msg: {
        type: 'call',
        text: 'Gemiste spraakoproep',
        callKind: 'missed_incoming',
        createdAt: '2026-10-08T20:48:00.000Z',
      },
    })).toEqual({
      type: 'call',
      presentation: {
        title: 'Gemiste spraakoproep',
        subtitle: 'Tikken om terug te bellen',
        kind: 'missed_incoming',
        isVideo: false,
        createdAt: '2026-10-08T20:48:00.000Z',
      },
    });
  });

  test('video call cards preserve their media type and use video-specific fallback copy', () => {
    expect(buildMessageBubbleCard({
      msg: {
        type: 'call',
        callKind: 'missed_incoming',
        mediaType: 'video',
        createdAt: '2026-10-08T20:50:00.000Z',
      },
    })).toEqual({
      type: 'call',
      presentation: {
        title: 'Gemiste video-oproep',
        subtitle: 'Tikken om terug te bellen',
        kind: 'missed_incoming',
        isVideo: true,
        createdAt: '2026-10-08T20:50:00.000Z',
      },
    });
  });

  test('declined call cards distinguish calling back from calling again', () => {
    const baseMessage = {
      type: 'call',
      text: 'Oproep geweigerd',
      createdAt: '2026-10-08T20:49:00.000Z',
    };

    expect(buildMessageBubbleCard({
      msg: { ...baseMessage, callKind: 'incoming_declined' },
    }).presentation).toMatchObject({
      title: 'Oproep geweigerd',
      subtitle: 'Tikken om terug te bellen',
      kind: 'incoming_declined',
    });
    expect(buildMessageBubbleCard({
      msg: { ...baseMessage, callKind: 'outgoing_declined' },
    }).presentation).toMatchObject({
      title: 'Oproep geweigerd',
      subtitle: 'Tikken om opnieuw te bellen',
      kind: 'outgoing_declined',
    });
  });

  test('pending and sending messages are labelled as in progress', () => {
    expect(getMessageStatusInfo({ pending: true })).toMatchObject({
      icon: 'clock',
      label: 'verzenden',
    });
    expect(getMessageStatusInfo({ deliveryState: 'sending' })).toMatchObject({
      icon: 'clock',
      label: 'verzenden',
    });
  });

  test('sent, delivered and read states keep distinct labels', () => {
    expect(getMessageStatusInfo({ deliveryState: 'sent' })).toMatchObject({ label: 'verstuurd' });
    expect(getMessageStatusInfo({ deliveryState: 'delivered' })).toMatchObject({ label: 'bezorgd' });
    expect(getMessageStatusInfo({ deliveryState: 'read' })).toMatchObject({ label: 'gelezen', read: true });
  });

  test('group receipt summary uses rendered ownership instead of message field ownership', () => {
    const msg = {
      receiptSummary: {
        recipientCount: 3,
        deliveredCount: 2,
        readCount: 0,
      },
    };

    expect(getMessageReceiptSummaryLabel(msg, true, true)).toBe('bezorgd bij 2/3');
    expect(getMessageReceiptSummaryLabel({ ...msg, isOwn: true }, true, false)).toBe('');
  });

  test('text card presentation includes group receipt summaries for own messages', () => {
    expect(buildTextMessageCardPresentation({
      text: 'Hallo',
      receiptSummary: {
        recipientCount: 2,
        deliveredCount: 2,
        readCount: 1,
      },
    }, {
      isOwn: true,
      isGroup: true,
    })).toMatchObject({
      receiptSummaryLabel: 'gelezen door 1/2',
    });
  });
});
