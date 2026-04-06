import { buildCallMessageCardPresentation } from './callMessageHelpers';
import {
  buildSharedContactMessageCardPresentation,
  buildStandardMessageBubblePresentation,
} from './messageBubbleHelpers';
import useAttachmentMessageRuntime from './useAttachmentMessageRuntime';

export default function useMessageBubbleCardPresentation({
  msg,
  isOwn,
  isFocused,
  isGroup,
  memberNames,
  currentUid,
  user,
  chatSearch,
}) {
  const attachmentRuntime = useAttachmentMessageRuntime({
    messageAttachment: msg.type === 'attachment' ? msg.attachment : null,
    messageId: msg.id,
    user,
    isOwn,
  });

  if (msg.type === 'attachment') {
    return {
      type: 'attachment',
      presentation: attachmentRuntime.presentation,
    };
  }

  if (msg.type === 'contact') {
    return {
      type: 'contact',
      presentation: buildSharedContactMessageCardPresentation(msg, {
        isOwn,
      }),
    };
  }

  if (msg.type === 'call') {
    return {
      type: 'call',
      presentation: buildCallMessageCardPresentation(msg, {
        isOwn,
        isFocused,
      }),
    };
  }

  if (msg.type === 'system') {
    return {
      type: 'system',
      presentation: {
        text: msg.text,
      },
    };
  }

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
