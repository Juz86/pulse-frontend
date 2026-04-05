// src/components/ChatInput.js
import React, { useCallback, useRef, useState } from 'react';
import { getSocket } from '../services/socket';
import { MAX_E2EE_ATTACHMENT_BYTES, normalizeAttachmentPayload } from '../lib/e2ee/attachmentPayload';
import {
  getAttachmentStrategyComposerHintState,
  getAttachmentRuntimeState,
} from '../lib/e2ee/config';
import { Send, PauseCircle, ImageIcon } from '../components/Icons';

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
  onSendAttachment,
  attachmentStrategyRuntime = null,
}) {
  const fileInputRef = useRef(null);
  const attachmentStatusTimerRef = useRef(null);
  const [attachmentStatus, setAttachmentStatus] = useState('');

  const showAttachmentStatus = useCallback((message) => {
    setAttachmentStatus(message);
    if (attachmentStatusTimerRef.current) {
      clearTimeout(attachmentStatusTimerRef.current);
      attachmentStatusTimerRef.current = null;
    }
    if (message) {
      attachmentStatusTimerRef.current = setTimeout(() => {
        setAttachmentStatus('');
      }, 2500);
    }
  }, []);

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

  const handleAttachmentChange = useCallback((event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_E2EE_ATTACHMENT_BYTES) {
      window.alert('Bijlagen mogen lokaal maximaal 2 MB zijn in deze testfase.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const normalizedAttachment = normalizeAttachmentPayload({
        name: file.name,
        url: typeof reader.result === 'string' ? reader.result : '',
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        caption: text.trim(),
      });
      showAttachmentStatus('Bijlage voorbereiden…');
      Promise.resolve(onSendAttachment?.(normalizedAttachment))
        .then(() => {
          showAttachmentStatus('Bijlage geupload');
        })
        .catch((error) => {
          showAttachmentStatus(error?.message || 'Upload mislukt');
        });
      setText('');
      setMentionSuggestions([]);
      setPendingMentions([]);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      stopTyping();
    };
    reader.readAsDataURL(file);
  }, [onSendAttachment, setMentionSuggestions, setPendingMentions, setText, showAttachmentStatus, stopTyping, text, textareaRef]);

  const textareaDescribedBy = [
    editingMsg ? 'chat-compose-editing' : null,
    replyTo ? 'chat-compose-reply' : null,
  ].filter(Boolean).join(' ') || undefined;
  const resolvedAttachmentStrategyRuntime = attachmentStrategyRuntime || getAttachmentRuntimeState({
    preferredStrategy: undefined,
  });
  const attachmentStrategyHintState = getAttachmentStrategyComposerHintState({
    preferredStrategy: resolvedAttachmentStrategyRuntime.preferredStrategy,
    effectiveStrategyOverride: resolvedAttachmentStrategyRuntime.effectiveStrategy,
    capabilities: resolvedAttachmentStrategyRuntime.capabilities,
    paused: pausedFeatures.chat,
    attachmentStatus,
  });

  return (
    <div className="chat-input-area">
      {editingMsg && (
        <div className="reply-preview" id="chat-compose-editing" role="status" aria-live="polite">
          <div className="reply-preview-inner">
            <span className="reply-preview-name"><span aria-hidden="true">✏️ </span>Bewerken</span>
            <span className="reply-preview-text">{editingMsg.text}</span>
          </div>
          <button type="button" className="reply-preview-close" aria-label="Bewerken annuleren" onClick={() => { setEditingMsg(null); setText(''); }}><span aria-hidden="true">✕</span></button>
        </div>
      )}
      {replyTo && (
        <div className="reply-preview" id="chat-compose-reply" role="status" aria-live="polite">
          <div className="reply-preview-inner">
            <span className="reply-preview-name">{replyTo.senderName}</span>
            <span className="reply-preview-text">{replyTo.text}</span>
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
      {attachmentStatus && !pausedFeatures.chat && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginBottom: 10,
            padding: '8px 12px',
            borderRadius: 12,
            background: 'rgba(124,58,237,0.12)',
            border: '1px solid rgba(124,58,237,0.25)',
            color: 'var(--text2)',
            fontSize: 13,
          }}
        >
          {attachmentStatus}
        </div>
      )}
      {attachmentStrategyHintState.visible && (
        <div
          role="note"
          style={{
            marginBottom: 10,
            padding: '7px 11px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'var(--text3)',
            fontSize: 12,
          }}
        >
          {attachmentStrategyHintState.text}
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.txt,.doc,.docx"
            style={{ display: 'none' }}
            onChange={handleAttachmentChange}
          />
          <button
            type="button"
            className="send-btn"
            aria-label="Bijlage toevoegen"
            onClick={() => fileInputRef.current?.click()}
            style={{ marginRight: 8 }}
          >
            <ImageIcon size={18} aria-hidden="true" />
          </button>
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
