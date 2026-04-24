import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AddReaction } from './Icons';
import UserAvatar from './UserAvatar';
import { normalizeSingleUserReaction } from '../lib/e2ee/messageReactions';
import { QUICK_REACTION_EMOJI } from './messageReactionConstants';

function getContactUid(contact) {
  return contact?.uid || contact?.id || null;
}

function findContactForUid(contacts = [], uid) {
  return contacts.find(contact => getContactUid(contact) === uid) || null;
}

function resolveReactionPerson(uid, {
  contacts = [],
  currentUid,
  currentUser,
  memberNames,
}) {
  const isCurrentUser = uid === currentUid;
  const contact = isCurrentUser ? null : findContactForUid(contacts, uid);
  const currentUserName = currentUser?.displayName || currentUser?.email || 'Jij';

  return {
    uid,
    isCurrentUser,
    displayName: isCurrentUser
      ? 'Jij'
      : contact?.displayName || memberNames?.[uid] || uid || 'Onbekend',
    avatarName: isCurrentUser
      ? currentUserName
      : contact?.displayName || memberNames?.[uid] || uid || 'Onbekend',
    photoURL: isCurrentUser
      ? currentUser?.photoURL || null
      : contact?.photoURL || null,
    subtitle: isCurrentUser ? 'Klik om te verwijderen' : '',
  };
}

export default function MessageReactionBar({
  reactions,
  currentUid,
  currentUser,
  contacts = [],
  memberNames = {},
  onReact,
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState(null);
  const [quickPickerOpen, setQuickPickerOpen] = useState(false);
  const detailsRef = useRef(null);

  const visibleReactions = useMemo(
    () => normalizeSingleUserReaction(reactions, currentUid),
    [reactions, currentUid],
  );
  const reactionEntries = useMemo(
    () => Object.entries(visibleReactions).filter(([, uids]) => uids?.length > 0),
    [visibleReactions],
  );
  const totalCount = reactionEntries.reduce((count, [, uids]) => count + uids.length, 0);
  const firstEmoji = reactionEntries[0]?.[0] || null;
  const reactionRows = useMemo(() => reactionEntries.flatMap(([emoji, uids]) => (
    uids.map(uid => ({
      emoji,
      ...resolveReactionPerson(uid, {
        contacts,
        currentUid,
        currentUser,
        memberNames,
      }),
    }))
  )), [contacts, currentUid, currentUser, memberNames, reactionEntries]);
  const filteredReactionRows = selectedEmoji
    ? reactionRows.filter(row => row.emoji === selectedEmoji)
    : reactionRows;

  useEffect(() => {
    if (!detailsOpen) {
      setQuickPickerOpen(false);
      return;
    }
    if (!firstEmoji) {
      setDetailsOpen(false);
      return;
    }
    const selectedStillVisible = reactionEntries.some(([emoji]) => emoji === selectedEmoji);
    if (!selectedStillVisible) setSelectedEmoji(firstEmoji);
  }, [detailsOpen, firstEmoji, reactionEntries, selectedEmoji]);

  useEffect(() => {
    if (!detailsOpen) return;

    function closeOnOutsideClick(event) {
      if (!detailsRef.current?.contains(event.target)) setDetailsOpen(false);
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') setDetailsOpen(false);
    }

    document.addEventListener('click', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('click', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [detailsOpen]);

  if (totalCount === 0) {
    return null;
  }

  function openDetails(event, emoji) {
    event.stopPropagation();
    setSelectedEmoji(emoji);
    setQuickPickerOpen(false);
    setDetailsOpen(true);
  }

  function handleReactFromDetails(emoji) {
    onReact(emoji);
    setDetailsOpen(false);
  }

  return (
    <div className={`msg-reactions${detailsOpen ? ' details-open' : ''}`}>
      {reactionEntries.map(([emoji, uids]) => (
        <button
          type="button"
          key={emoji}
          className={`msg-reaction-pill${uids.includes(currentUid) ? ' mine' : ''}`}
          aria-label={`Bekijk reacties met ${emoji}${uids.length > 1 ? `, ${uids.length} reacties totaal` : ''}`}
          aria-expanded={detailsOpen && selectedEmoji === emoji}
          onClick={(event) => openDetails(event, emoji)}
        >
          <span aria-hidden="true">{emoji}</span>
          {uids.length > 1 && <span aria-hidden="true">{uids.length}</span>}
        </button>
      ))}

      {detailsOpen && (
        <div
          className="msg-reaction-details"
          ref={detailsRef}
          role="dialog"
          aria-label="Reacties op bericht"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="msg-reaction-details-title">
            {totalCount} {totalCount === 1 ? 'reactie' : 'reacties'}
          </div>

          <div className="msg-reaction-tabs" role="group" aria-label="Reacties filteren">
            <button
              type="button"
              className={`msg-reaction-add-btn${quickPickerOpen ? ' active' : ''}`}
              aria-label="Reactie toevoegen"
              aria-expanded={quickPickerOpen}
              onClick={() => setQuickPickerOpen(open => !open)}
            >
              <AddReaction size={22} aria-hidden="true" />
            </button>
            {reactionEntries.map(([emoji, uids]) => (
              <button
                type="button"
                key={emoji}
                className={`msg-reaction-tab${selectedEmoji === emoji ? ' selected' : ''}`}
                aria-pressed={selectedEmoji === emoji}
                onClick={() => {
                  setSelectedEmoji(emoji);
                  setQuickPickerOpen(false);
                }}
              >
                <span aria-hidden="true">{emoji}</span>
                <span>{uids.length}</span>
              </button>
            ))}
          </div>

          {quickPickerOpen && (
            <div className="msg-reaction-quick-row" role="group" aria-label="Snelle reacties">
              {QUICK_REACTION_EMOJI.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  aria-label={`Reageer met ${emoji}`}
                  onClick={() => handleReactFromDetails(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <div className="msg-reaction-details-divider" />

          <div className="msg-reaction-user-list">
            {filteredReactionRows.map((row) => {
              const rowContent = (
                <>
                  <UserAvatar
                    photoURL={row.photoURL}
                    displayName={row.avatarName}
                    className="reaction-detail-avatar"
                    decorative
                  />
                  <span className="msg-reaction-user-copy">
                    <span className="msg-reaction-user-name">{row.displayName}</span>
                    {row.subtitle && <span className="msg-reaction-user-sub">{row.subtitle}</span>}
                  </span>
                  <span className="msg-reaction-user-emoji" aria-hidden="true">{row.emoji}</span>
                </>
              );

              return row.isCurrentUser ? (
                <button
                  type="button"
                  key={`${row.uid}-${row.emoji}`}
                  className="msg-reaction-user-row clickable"
                  aria-label={`Verwijder je reactie ${row.emoji}`}
                  onClick={() => handleReactFromDetails(row.emoji)}
                >
                  {rowContent}
                </button>
              ) : (
                <div key={`${row.uid}-${row.emoji}`} className="msg-reaction-user-row">
                  {rowContent}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
