import React, { useEffect, useMemo } from 'react';
import { Search, StarFilled, XIcon } from './Icons';
import { getMessageDisplayText } from '../lib/e2ee/messageModel';

function messageDate(value) {
  const date = value?.toDate?.() || (value?._seconds ? new Date(value._seconds * 1000) : new Date(value));
  return Number.isNaN(date?.getTime?.()) ? '' : date.toLocaleDateString('nl-NL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function highlightMatch(text, query) {
  const value = String(text || '');
  const term = query.trim();
  if (!term) return value;
  const parts = value.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
  return parts.map((part, index) => part.toLocaleLowerCase() === term.toLocaleLowerCase()
    ? <mark key={index}>{part}</mark>
    : part);
}

export default function ConversationSearchPanel({
  activeConv,
  messages,
  chatSearch,
  setChatSearch,
  chatSearchIdx,
  setChatSearchIdx,
  chatSearchRef,
  getConvName,
  onClose,
  onJumpToMsg,
  mode = 'search',
  starredMsgs = [],
}) {
  const query = chatSearch.trim().toLocaleLowerCase();
  const isStarredMode = mode === 'starred';
  const sourceMessages = useMemo(() => isStarredMode
    ? messages.filter(message => starredMsgs.includes(message.id))
    : messages, [messages, isStarredMode, starredMsgs]);
  const matches = useMemo(() => query
    ? sourceMessages.filter(message => getMessageDisplayText(message).toLocaleLowerCase().includes(query))
    : (isStarredMode ? sourceMessages : []), [sourceMessages, query, isStarredMode]);
  const currentIndex = matches.length ? chatSearchIdx % matches.length : 0;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => chatSearchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [chatSearchRef]);

  function close() {
    chatSearchRef.current?.blur();
    setChatSearch('');
    setChatSearchIdx(0);
    onClose();
  }

  function clearSearch() {
    setChatSearch('');
    setChatSearchIdx(0);
  }

  return (
    <aside className={`conversation-search-panel${isStarredMode ? ' conversation-search-panel--starred' : ''}`} aria-label={`${isStarredMode ? 'Berichten met ster' : 'Berichten doorzoeken'} in ${getConvName(activeConv)}`}>
      <header className="conversation-search-panel__header">
        {isStarredMode ? (
          <span className="conversation-search-panel__header-icon" aria-hidden="true">
            <StarFilled size={20} />
          </span>
        ) : (
          <span className="conversation-search-panel__header-icon" aria-hidden="true">
            <Search size={20} />
          </span>
        )}
        <div className="conversation-search-panel__heading">
          <strong>{isStarredMode ? 'Berichten met ster' : 'Zoeken'}</strong>
          <span>{getConvName(activeConv)}</span>
        </div>
        <button type="button" className="conversation-search-panel__close" aria-label={`${isStarredMode ? 'Berichten met ster' : 'Zoeken'} sluiten`} onClick={close}>
          <XIcon size={22} aria-hidden="true" />
        </button>
      </header>
      <div className="conversation-search-panel__search" role="search">
        <Search size={22} aria-hidden="true" />
        <input
          ref={chatSearchRef}
          value={chatSearch}
          onChange={event => { setChatSearch(event.target.value); setChatSearchIdx(0); }}
          onKeyDown={event => {
            if (event.key === 'Enter' && matches.length) setChatSearchIdx(index => (index + 1) % matches.length);
            if (event.key === 'Escape') close();
          }}
          placeholder={isStarredMode ? 'Zoeken in berichten met ster' : 'Zoeken'}
          aria-label={`${isStarredMode ? 'Zoeken in berichten met ster' : 'Zoeken in gesprek'} met ${getConvName(activeConv)}`}
          aria-controls="chat-messages-log"
        />
        {(chatSearch || !isStarredMode) && (
          <button
            type="button"
            className="conversation-search-panel__clear"
            aria-label={chatSearch ? 'Zoekterm wissen' : 'Zoeken sluiten'}
            onClick={chatSearch ? clearSearch : close}
          >
            <XIcon size={19} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="conversation-search-panel__results" aria-live="polite">
        {!query && !isStarredMode && <p className="conversation-search-panel__hint">Zoek naar berichten in {getConvName(activeConv)}.</p>}
        {!query && isStarredMode && !matches.length && <p className="conversation-search-panel__hint">Nog geen berichten met ster in {getConvName(activeConv)}.</p>}
        {query && !matches.length && <p className="conversation-search-panel__hint">{isStarredMode ? 'Geen berichten met ster gevonden.' : 'Geen berichten gevonden.'}</p>}
        {matches.slice().reverse().map((message) => {
          const originalIndex = matches.indexOf(message);
          return (
            <button
              type="button"
              key={message.id || `${message.createdAt}-${originalIndex}`}
              className={`conversation-search-result${query && originalIndex === currentIndex ? ' is-active' : ''}`}
              onClick={() => isStarredMode ? onJumpToMsg?.(message.id) : setChatSearchIdx(originalIndex)}
            >
              <span className="conversation-search-result__date">{messageDate(message.createdAt)}</span>
              <span className="conversation-search-result__text">{highlightMatch(getMessageDisplayText(message), chatSearch)}</span>
            </button>
          );
        })}
      </div>

      {query && (
        <footer className="conversation-search-panel__mobile-nav" aria-live="polite">
          <div className="conversation-search-panel__mobile-nav-buttons">
            <button
              type="button"
              aria-label="Vorig resultaat"
              disabled={!matches.length}
              onClick={() => setChatSearchIdx(index => matches.length ? (index - 1 + matches.length) % matches.length : 0)}
            >
              <span aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Volgend resultaat"
              disabled={!matches.length}
              onClick={() => setChatSearchIdx(index => matches.length ? (index + 1) % matches.length : 0)}
            >
              <span aria-hidden="true" />
            </button>
          </div>
          <span>{matches.length ? `${currentIndex + 1} van ${matches.length} resultaten` : 'Geen resultaten'}</span>
        </footer>
      )}
    </aside>
  );
}
