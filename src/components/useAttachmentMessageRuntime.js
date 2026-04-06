import { useEffect, useState } from 'react';
import {
  createAttachmentMessageActionRuntime,
  getInitialAttachmentActionState,
} from '../lib/e2ee/attachmentAccessAdapter';
import { buildAttachmentMessageCardPresentation } from '../lib/e2ee/attachmentPresentation';

export default function useAttachmentMessageRuntime({
  messageAttachment,
  messageId,
  user,
  isOwn,
}) {
  const [resolvedAttachment, setResolvedAttachment] = useState(null);
  const [resolvedAttachmentAccess, setResolvedAttachmentAccess] = useState(null);
  const [attachmentActionError, setAttachmentActionError] = useState('');
  const [attachmentBusy, setAttachmentBusy] = useState(false);

  useEffect(() => {
    const initialActionState = getInitialAttachmentActionState();
    setResolvedAttachment(initialActionState.resolvedAttachment);
    setResolvedAttachmentAccess(initialActionState.resolvedAttachmentAccess);
    setAttachmentActionError(initialActionState.attachmentActionError);
    setAttachmentBusy(initialActionState.attachmentBusy);
  }, [messageId]);

  if (!messageAttachment) {
    return {
      presentation: null,
    };
  }

  const { runAttachmentAction } = createAttachmentMessageActionRuntime(
    messageAttachment,
    resolvedAttachment,
    user,
    {
      setAttachmentBusy,
      setResolvedAttachment,
      setResolvedAttachmentAccess,
      setAttachmentActionError,
    }
  );

  const presentation = buildAttachmentMessageCardPresentation(
    messageAttachment,
    resolvedAttachment,
    resolvedAttachmentAccess,
    {
      busy: attachmentBusy,
      isOwn,
      actionError: attachmentActionError,
      onOpen: () => runAttachmentAction('open'),
      onAction: runAttachmentAction,
    }
  );

  return {
    presentation,
  };
}
