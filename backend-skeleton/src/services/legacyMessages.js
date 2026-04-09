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

export function buildSystemMessage({
  id,
  convId,
  text,
  createdAt = new Date().toISOString(),
}) {
  return {
    id,
    conversationId: convId,
    convId,
    senderId: 'system',
    senderUserId: 'system',
    senderName: 'Pulse',
    text: text || '',
    type: 'system',
    sharedContact: null,
    mentions: [],
    protocol: 'legacy',
    senderDeviceId: null,
    replyTo: null,
    createdAt,
    status: 'verzonden',
    deliveryState: 'sent',
    reactions: {},
  };
}

export function buildCallMessage({
  id,
  convId,
  senderId,
  senderName = null,
  isVideo = false,
  direction = 'completed',
  duration = 0,
  createdAt = new Date().toISOString(),
}) {
  return {
    id,
    conversationId: convId,
    convId,
    senderId,
    senderUserId: senderId,
    senderName,
    text: '',
    type: 'call',
    sharedContact: null,
    mentions: [],
    protocol: 'legacy',
    senderDeviceId: null,
    replyTo: null,
    createdAt,
    status: 'verzonden',
    deliveryState: 'sent',
    reactions: {},
    isVideo: !!isVideo,
    direction: direction || 'completed',
    duration: Number(duration) || 0,
  };
}
