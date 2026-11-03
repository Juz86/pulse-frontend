export function usesV2ConversationProtocol(runtimeEnabled, conversation) {
  return runtimeEnabled === true
    && ['v2_pending', 'v2_required'].includes(conversation?.e2eeState);
}
