import React from 'react';
import { normalizeSingleUserReaction } from '../lib/e2ee/messageReactions';

export default function MessageReactionBar({
  reactions,
  currentUid,
  onReact,
}) {
  const visibleReactions = normalizeSingleUserReaction(reactions, currentUid);

  if (!Object.entries(visibleReactions).some(([, uids]) => uids?.length > 0)) {
    return null;
  }

  return (
    <div className="msg-reactions">
      {Object.entries(visibleReactions)
        .filter(([, uids]) => uids?.length > 0)
        .map(([emoji, uids]) => (
          <button
            type="button"
            key={emoji}
            className={`msg-reaction-pill${uids.includes(currentUid) ? ' mine' : ''}`}
            aria-label={`${uids.includes(currentUid) ? 'Verwijder je reactie' : 'Reageer met'} ${emoji}${uids.length > 1 ? `, ${uids.length} reacties totaal` : ''}`}
            onClick={() => onReact(emoji)}
          >
            <span aria-hidden="true">{emoji}</span>
            {uids.length > 1 && <span aria-hidden="true">{uids.length}</span>}
          </button>
        ))}
    </div>
  );
}
