import { usesV2ConversationProtocol } from './conversationProtocolPolicy';

describe('usesV2ConversationProtocol', () => {
  test.each(['v2_pending', 'v2_required'])(
    'uses v2 for an enabled %s conversation',
    (e2eeState) => {
      expect(usesV2ConversationProtocol(true, { e2eeState })).toBe(true);
    },
  );

  test.each([null, undefined, 'legacy', 'signal_v1'])(
    'keeps %s conversations on the existing transport',
    (e2eeState) => {
      expect(usesV2ConversationProtocol(true, { e2eeState })).toBe(false);
    },
  );

  test('does not use v2 when the authenticated runtime is disabled', () => {
    expect(usesV2ConversationProtocol(false, { e2eeState: 'v2_required' })).toBe(false);
  });
});
