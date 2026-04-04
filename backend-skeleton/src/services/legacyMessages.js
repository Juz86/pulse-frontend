export function buildLegacyMessage({
  id,
  convId,
  message,
}) {
  return {
    id,
    conversationId: convId,
    convId,
    senderId: message.senderId,
    senderUserId: message.senderId,
    senderName: message.senderName || null,
    text: message.text || '',
    type: message.type || 'text',
    sharedContact: message.sharedContact || null,
    mentions: Array.isArray(message.mentions) ? message.mentions : [],
    protocol: message.protocol || 'legacy',
    senderDeviceId: message.senderDeviceId || null,
    replyTo: message.replyTo || null,
    createdAt: message.createdAt || new Date().toISOString(),
    status: 'verzonden',
    deliveryState: 'sent',
    reactions: {},
  };
}
