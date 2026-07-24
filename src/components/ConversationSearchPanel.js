import React, { useEffect, useMemo } from 'react';
import { Search, XIcon } from './Icons';
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
}) {
  const query = chatSearch.trim().toLocaleLowerCase();
  const matches = useMemo(() => query
    ? messages.filter(message => getMessageDisplayText(message).toLocaleLowerCase().includes(query))
    : [], [messages, query]);
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

  return (
    <aside className="conversation-search-panel" aria-label={`Berichten doorzoeken in ${getConvName(activeConv)}`}>
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
          placeholder="Zoeken"
          aria-label={`Zoeken in gesprek met ${getConvName(activeConv)}`}
          aria-controls="chat-messages-log"
        />
        {chatSearch && (
          <button type="button" className="conversation-search-panel__clear" aria-label="Zoekterm wissen" onClick={() => { setChatSearch(''); setChatSearchIdx(0); }}>
            <XIcon size={19} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="conversation-search-panel__results" aria-live="polite">
        {!query && <p className="conversation-search-panel__hint">Zoek naar berichten in {getConvName(activeConv)}.</p>}
        {query && !matches.length && <p className="conversation-search-panel__hint">Geen berichten gevonden.</p>}
        {matches.slice().reverse().map((message) => {
          const originalIndex = matches.indexOf(message);
          return (
            <button
              type="button"
              key={message.id || `${message.createdAt}-${originalIndex}`}
              className={`conversation-search-result${originalIndex === currentIndex ? ' is-active' : ''}`}
              onClick={() => setChatSearchIdx(originalIndex)}
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
