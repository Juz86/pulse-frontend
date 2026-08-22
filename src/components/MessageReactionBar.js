import React, { useMemo } from 'react';
import { normalizeSingleUserReaction } from '../lib/e2ee/messageReactions';

// Keep reactions lightweight in the conversation: the small pills below a
// message are the complete UI. Pulse deliberately does not open a separate
// reaction overview with participant lists.
const MessageReactionBar = React.memo(function MessageReactionBar({
  reactions,
  currentUid,
  onReact,
}) {
  const reactionEntries = useMemo(() => (
    Object.entries(normalizeSingleUserReaction(reactions, currentUid))
      .filter(([, uids]) => uids?.length > 0)
  ), [reactions, currentUid]);

  if (reactionEntries.length === 0) return null;

  return (
    <div className="msg-reactions">
      {reactionEntries.map(([emoji, uids]) => (
        <button
          type="button"
          key={emoji}
          className={`msg-reaction-pill${uids.includes(currentUid) ? ' mine' : ''}`}
          aria-label={`Reageer met ${emoji}`}
          onClick={(event) => {
            event.stopPropagation();
            onReact(emoji);
          }}
        >
          <span aria-hidden="true">{emoji}</span>
          {uids.length > 1 && <span aria-hidden="true">{uids.length}</span>}
        </button>
      ))}
    </div>
  );
});

export default MessageReactionBar;
