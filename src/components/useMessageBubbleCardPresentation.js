import { buildCallMessageCardPresentation } from './callMessageHelpers';
import {
  buildSharedContactMessageCardPresentation,
  buildStandardMessageBubblePresentation,
} from './messageBubbleHelpers';
import useAttachmentMessageRuntime from './useAttachmentMessageRuntime';

function buildAttachmentCardPresentation(msg, attachmentRuntime) {
  return {
    type: 'attachment',
    presentation: {
      ...attachmentRuntime.presentation,
      createdAt: msg.createdAt,
    },
  };
}

function buildContactCardPresentation(msg, isOwn) {
  return {
    type: 'contact',
    presentation: buildSharedContactMessageCardPresentation(msg, {
      isOwn,
    }),
  };
}

function buildCallCardPresentation(msg, isOwn, isFocused) {
  return {
    type: 'call',
    presentation: {
      ...buildCallMessageCardPresentation(msg, {
        isOwn,
        isFocused,
      }),
      createdAt: msg.createdAt,
    },
  };
}

function buildSystemCardPresentation(msg) {
  return {
    type: 'system',
    presentation: {
      text: msg.text,
    },
  };
}

function buildTextCardPresentation(
  msg,
  { isOwn, isFocused, isGroup, memberNames, currentUid, chatSearch },
) {
  return {
    type: 'text',
    presentation: buildStandardMessageBubblePresentation(msg, {
      isOwn,
      isFocused,
      isGroup,
      memberNames,
      currentUid,
      chatSearch,
    }),
  };
}

function buildMessageBubbleCardPresentation({
  msg,
  attachmentRuntime,
  isOwn,
  isFocused,
  isGroup,
  memberNames,
  currentUid,
  chatSearch,
}) {
  switch (msg.type) {
    case 'attachment':
      return buildAttachmentCardPresentation(msg, attachmentRuntime);
    case 'contact':
      return buildContactCardPresentation(msg, isOwn);
    case 'call':
      return buildCallCardPresentation(msg, isOwn, isFocused);
    case 'system':
      return buildSystemCardPresentation(msg);
    default:
      return buildTextCardPresentation(msg, {
        isOwn,
        isFocused,
        isGroup,
        memberNames,
        currentUid,
        chatSearch,
      });
  }
}

export default function useMessageBubbleCardPresentation({
  message,
}) {
  const {
    msg,
    isOwn,
    isFocused,
    isGroup,
    memberNames,
    currentUid,
    user,
    chatSearch,
  } = message;
  const attachmentRuntime = useAttachmentMessageRuntime({
    messageAttachment: msg.type === 'attachment' ? msg.attachment : null,
    messageId: msg.id,
    user,
    isOwn,
  });

  return buildMessageBubbleCardPresentation({
    msg,
    attachmentRuntime,
    isOwn,
    isFocused,
    isGroup,
    memberNames,
    currentUid,
    chatSearch,
  });
}
