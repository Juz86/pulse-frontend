import { BACKEND_URL } from './socket';
import { normalizeIncomingMessage } from '../lib/e2ee/messageModel';
import { readCachedMessages } from '../utils';

const CALL_HISTORY_LIMIT_PER_CONVERSATION = 120;

function isCallMessage(message) {
  return (message?.type || message?.messageType) === 'call' && !message?.deleted;
}

function callHistoryKey(message) {
  if (message.sessionId) {
    return [message.conversationId, message.sessionId, message.callKind].filter(Boolean).join(':');
  }
  return message.id
    || [message.conversationId, message.callKind, message.createdAt].filter(Boolean).join(':');
}

async function fetchWithAuth(user, url, fetchImpl, forceRefresh = false) {
  const token = await user.getIdToken(forceRefresh);
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!forceRefresh && (response.status === 401 || response.status === 403)) {
    return fetchWithAuth(user, url, fetchImpl, true);
  }
  return response;
}

async function fetchConversationCallMessages({ user, conversation, currentDeviceId, fetchImpl }) {
  const query = new URLSearchParams({
    limit: String(CALL_HISTORY_LIMIT_PER_CONVERSATION),
    offset: '0',
  });
  if (currentDeviceId) query.set('deviceId', currentDeviceId);

  const feedUrl = `${BACKEND_URL}/messages/feed/${conversation.id}?${query.toString()}`;
  let response = await fetchWithAuth(user, feedUrl, fetchImpl);
  if (!response.ok) {
    const legacyUrl = `${BACKEND_URL}/api/messages/${conversation.id}?${query.toString()}`;
    response = await fetchWithAuth(user, legacyUrl, fetchImpl);
  }
  if (!response.ok) throw new Error('call_history_load_failed');

  const payload = await response.json();
  return (Array.isArray(payload) ? payload : [])
    .filter(isCallMessage)
    .map((message) => ({
      ...normalizeIncomingMessage(message, user.uid),
      conversationId: message.conversationId || message.convId || conversation.id,
    }));
}

function buildConversationCallFallback(conversation, currentUid) {
  if (conversation?.lastMessageType !== 'call' || !conversation.lastCallEvent) return null;
  const presentation = conversation.lastCallEvent.presentations?.[currentUid] || null;
  const kind = presentation?.kind || 'missed_incoming';
  return {
    id: conversation.lastCallEvent.messageId || null,
    conversationId: conversation.id,
    sessionId: conversation.lastCallEvent.sessionId || null,
    type: 'call',
    messageType: 'call',
    callKind: kind,
    direction: kind.startsWith('incoming_') || kind === 'missed_incoming' ? 'incoming' : 'outgoing',
    text: presentation?.label || conversation.lastMessage || '',
    duration: Number(conversation.lastCallEvent.duration) || 0,
    isVideo: !!conversation.lastCallEvent.isVideo || conversation.lastCallEvent.mediaType === 'video',
    mediaType: conversation.lastCallEvent.mediaType || (conversation.lastCallEvent.isVideo ? 'video' : 'audio'),
    createdAt: conversation.lastCallEvent.createdAt || conversation.lastMessageAt || conversation.updatedAt || null,
  };
}

export async function loadPulseCallHistory({
  user,
  conversations = [],
  currentDeviceId = null,
  fetchImpl = fetch,
}) {
  if (!user?.uid) return [];
  const directConversations = conversations.filter((conversation) => (
    conversation?.id && !conversation.isGroup && !conversation.isDraft
  ));

  const results = await Promise.all(directConversations.map(async (conversation) => {
    const cachedCalls = readCachedMessages(user.uid, conversation.id)
      .filter(isCallMessage)
      .map((message) => ({ ...message, conversationId: message.conversationId || conversation.id }));
    let remoteCalls = [];
    let remoteLoaded = false;
    try {
      remoteCalls = await fetchConversationCallMessages({
        user,
        conversation,
        currentDeviceId,
        fetchImpl,
      });
      remoteLoaded = true;
    } catch {
      // De lokale berichtcache houdt de oproepenlijst bruikbaar bij tijdelijk
      // netwerkverlies. De conversatiesamenvatting vangt de laatste oproep op.
    }
    const fallback = buildConversationCallFallback(conversation, user.uid);
    return {
      remoteLoaded,
      messages: fallback ? [...remoteCalls, ...cachedCalls, fallback] : [...remoteCalls, ...cachedCalls],
    };
  }));

  const messages = results.flatMap((result) => result.messages);
  if (directConversations.length > 0 && !results.some((result) => result.remoteLoaded) && messages.length === 0) {
    throw new Error('call_history_load_failed');
  }

  const seen = new Set();
  return messages
    .filter((message) => {
      const key = callHistoryKey(message);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0));
}

