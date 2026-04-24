import {
  buildTextMessageCardPresentation,
  getMessageReceiptSummaryLabel,
  getMessageStatusInfo,
} from './messageBubbleHelpers';

describe('messageBubbleHelpers', () => {
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
