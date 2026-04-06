import { buildCallMessageCardPresentation } from './callMessageHelpers';
import {
  buildSharedContactMessageCardPresentation,
  buildStandardMessageBubblePresentation,
} from './messageBubbleHelpers';
import useAttachmentMessageRuntime from './useAttachmentMessageRuntime';

function buildAttachmentCardPresentation(message, attachmentRuntime) {
  return {
    type: 'attachment',
    presentation: {
      ...attachmentRuntime.presentation,
      createdAt: message.msg.createdAt,
    },
  };
}

function buildContactCardPresentation(message) {
  return {
    type: 'contact',
    presentation: buildSharedContactMessageCardPresentation(message.msg, {
      isOwn: message.isOwn,
    }),
  };
}

function buildCallCardPresentation(message) {
  return {
    type: 'call',
    presentation: {
      ...buildCallMessageCardPresentation(message.msg, {
        isOwn: message.isOwn,
        isFocused: message.isFocused,
      }),
      createdAt: message.msg.createdAt,
    },
  };
}

function buildSystemCardPresentation(message) {
  return {
    type: 'system',
    presentation: {
      text: message.msg.text,
    },
  };
}

function buildTextCardPresentation(message) {
  return {
    type: 'text',
    presentation: buildStandardMessageBubblePresentation(message.msg, {
      isOwn: message.isOwn,
      isFocused: message.isFocused,
      isGroup: message.isGroup,
      memberNames: message.memberNames,
      currentUid: message.currentUid,
      chatSearch: message.chatSearch,
    }),
  };
}

function buildAttachmentMessageRuntimeInput(message) {
  return {
    messageAttachment: message.msg.type === 'attachment' ? message.msg.attachment : null,
    messageId: message.msg.id,
    user: message.user,
    isOwn: message.isOwn,
  };
}

function buildMessageBubbleCardPresentation({
  message,
  attachmentRuntime,
}) {
  switch (message.msg.type) {
    case 'attachment':
      return buildAttachmentCardPresentation(message, attachmentRuntime);
    case 'contact':
      return buildContactCardPresentation(message);
    case 'call':
      return buildCallCardPresentation(message);
    case 'system':
      return buildSystemCardPresentation(message);
    default:
      return buildTextCardPresentation(message);
  }
}

export default function useMessageBubbleCardPresentation({
  message,
}) {
  const attachmentRuntime = useAttachmentMessageRuntime(
    buildAttachmentMessageRuntimeInput(message)
  );

  return buildMessageBubbleCardPresentation({
    message,
    attachmentRuntime,
  });
}
