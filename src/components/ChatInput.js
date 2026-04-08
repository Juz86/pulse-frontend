// src/components/ChatInput.js
import React, { useCallback } from 'react';
import { getSocket } from '../services/socket';
import { Send, PauseCircle } from '../components/Icons';
import { getMessageDisplayText } from '../lib/e2ee/messageModel';

const ChatInput = React.memo(function ChatInput({
  text,
  setText,
  editingMsg,
  setEditingMsg,
  replyTo,
  setReplyTo,
  mentionSuggestions,
  setMentionSuggestions,
  mentionSelIdx,
  setMentionSelIdx,
  setPendingMentions,
  pausedFeatures,
  activeConv,
  user,
  contacts,
  textareaRef,
  activeConvRef,
  typingTimerRef,
  stopTyping,
  onSend,
}) {
  const insertMention = useCallback((member) => {
    const cursorPos = textareaRef.current?.selectionStart ?? text.length;
    const textBefore = text.slice(0, cursorPos);
    const atMatch = textBefore.match(/@([^\s@]*)$/);
    if (!atMatch) return;
    const start = cursorPos - atMatch[0].length;
    const newText = text.slice(0, start) + `@${member.displayName} ` + text.slice(cursorPos);
    setText(newText);
    setPendingMentions(prev =>
      prev.find(m => m.uid === member.uid) ? prev : [...prev, { uid: member.uid, displayName: member.displayName }]
    );
    setMentionSuggestions([]);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [text, setText, setPendingMentions, setMentionSuggestions, textareaRef]);

  const handleKeyDown = useCallback((e) => {
    if (mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionSelIdx(i => Math.min(i + 1, mentionSuggestions.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionSelIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(mentionSuggestions[mentionSelIdx]); return; }
      if (e.key === 'Escape')    { setMentionSuggestions([]); return; }
    }
    if (e.key === 'Escape' && editingMsg) { setEditingMsg(null); setText(''); return; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  }, [mentionSuggestions, mentionSelIdx, editingMsg, insertMention, setMentionSelIdx, setMentionSuggestions, setEditingMsg, setText, onSend]);

  const handleTyping = useCallback((val) => {
    setText(val);
    if (activeConv?.isGroup) {
      const cursorPos = textareaRef.current?.selectionStart ?? val.length;
      const textBefore = val.slice(0, cursorPos);
      const atMatch = textBefore.match(/@([^\s@]*)$/);
      if (atMatch) {
        const query = atMatch[1].toLowerCase();
        const suggestions = (activeConv.members || [])
          .filter(uid => uid !== user.uid)
          .map(uid => {
            const displayName = activeConv.memberNames?.[uid] || uid;
            const contact = contacts.find(c => c.uid === uid);
            return { uid, displayName, photoURL: contact?.photoURL || null };
          })
          .filter(m => m.displayName.toLowerCase().includes(query));
        setMentionSuggestions(suggestions);
        setMentionSelIdx(0);
      } else {
        setMentionSuggestions([]);
      }
    }
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
    const conv = activeConvRef.current;
    if (!conv) return;
    getSocket()?.emit('typing:start', { convId: conv.id, name: user.displayName });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(stopTyping, 2000);
  }, [activeConv, user, contacts, setText, setMentionSuggestions, setMentionSelIdx, textareaRef, activeConvRef, typingTimerRef, stopTyping]);

  const textareaDescribedBy = [
    editingMsg ? 'chat-compose-editing' : null,
    replyTo ? 'chat-compose-reply' : null,
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className="chat-input-area">
      {editingMsg && (
        <div className="reply-preview" id="chat-compose-editing" role="status" aria-live="polite">
          <div className="reply-preview-inner">
            <span className="reply-preview-name"><span aria-hidden="true">✏️ </span>Bewerken</span>
            <span className="reply-preview-text">{getMessageDisplayText(editingMsg)}</span>
          </div>
          <button type="button" className="reply-preview-close" aria-label="Bewerken annuleren" onClick={() => { setEditingMsg(null); setText(''); }}><span aria-hidden="true">✕</span></button>
        </div>
      )}
      {replyTo && (
        <div className="reply-preview" id="chat-compose-reply" role="status" aria-live="polite">
          <div className="reply-preview-inner">
            <span className="reply-preview-name">{replyTo.senderName}</span>
            <span className="reply-preview-text">{getMessageDisplayText(replyTo)}</span>
          </div>
          <button type="button" className="reply-preview-close" aria-label="Antwoord annuleren" onClick={() => setReplyTo(null)}><span aria-hidden="true">✕</span></button>
        </div>
      )}
      {mentionSuggestions.length > 0 && (
        <div className="mention-popup" role="listbox" aria-label="Mention suggesties">
          {mentionSuggestions.map((m, i) => (
            <button
              key={m.uid}
              type="button"
              role="option"
              aria-selected={i === mentionSelIdx}
              className={`mention-item${i === mentionSelIdx ? ' selected' : ''}`}
              onMouseDown={e => { e.preventDefault(); insertMention(m); }}
            >
              <div className="mention-avatar">
                {m.photoURL
                  ? <img src={m.photoURL} alt="" aria-hidden="true" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} loading="lazy" />
                  : <span aria-hidden="true">{m.displayName?.[0]?.toUpperCase() || '?'}</span>
                }
              </div>
              <span className="mention-name">{m.displayName}</span>
            </button>
          ))}
        </div>
      )}
      {pausedFeatures.chat ? (
        <div className="chat-paused-notice" role="status" aria-live="polite">
          <PauseCircle size={16} style={{ flexShrink: 0 }} aria-hidden="true" />
          {' '}Chatten is gepauzeerd door je ouder
          {(!pausedFeatures.call || !pausedFeatures.video)
            ? `, maar je kan nog wel ${[!pausedFeatures.call && 'bellen', !pausedFeatures.video && 'videobellen'].filter(Boolean).join(' en ')}`
            : ''}.
        </div>
      ) : (
        <div className="input-row">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            rows={1}
            aria-label="Bericht invoeren"
            aria-describedby={textareaDescribedBy}
            placeholder="Stuur een bericht…"
            value={text}
            onChange={e => handleTyping(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button type="button" className="send-btn" aria-label="Bericht versturen" onClick={onSend}><Send size={18} aria-hidden="true" /></button>
        </div>
      )}
    </div>
  );
});

export default ChatInput;
