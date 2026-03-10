// src/screens/ChatScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { getSocket, BACKEND_URL, startCall, endCall } from '../services/socket';
import CallOverlay from '../components/CallOverlay';

export default function ChatScreen({ user }) {
  const [conversations, setConversations] = useState([]);
  const [activeConv,    setActiveConv]    = useState(null);
  const [messages,      setMessages]      = useState([]);
  const [text,          setText]          = useState('');
  const [typing,        setTyping]        = useState(false);
  const [typingName,    setTypingName]    = useState('');
  const [searchEmail,   setSearchEmail]   = useState('');
  const [searchResult,  setSearchResult]  = useState(null);
  const [searchErr,     setSearchErr]     = useState('');
  const [activeCall,    setActiveCall]    = useState(null);  // { toUid, isVideo, name, localStream, remoteStream }
  const [showNewChat,   setShowNewChat]   = useState(false);

  const msgEndRef   = useRef(null);
  const typingTimer = useRef(null);
  const socket      = getSocket();

  // ── Gesprekken laden ──────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const res  = await fetch(`${BACKEND_URL}/api/conversations/${user.uid}`);
      const data = await res.json();
      setConversations(data);
    } catch (e) { console.error(e); }
  }, [user.uid]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // ── Socket events ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    socket.on('message:received', (msg) => {
      setMessages(prev => [...prev, msg]);
      loadConversations();
      msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });

    socket.on('typing:update', ({ uid, name, typing }) => {
      if (typing) { setTyping(true); setTypingName(name || 'Iemand'); }
      else        { setTyping(false); }
    });

    socket.on('user:status', ({ uid, online }) => {
      setConversations(prev => prev.map(c => {
        const updated = { ...c };
        if (c.members?.includes(uid)) updated.memberOnline = online;
        return updated;
      }));
    });

    return () => {
      socket.off('message:received');
      socket.off('typing:update');
      socket.off('user:status');
    };
  }, [socket, loadConversations]);

  // ── Gesprek openen ────────────────────────────────────────────────────────
  async function openConversation(conv) {
    setActiveConv(conv);
    socket?.emit('conversation:join', { convId: conv.id });
    try {
      const res  = await fetch(`${BACKEND_URL}/api/messages/${conv.id}`);
      const data = await res.json();
      setMessages(data);
      setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'auto' }), 100);
    } catch (e) { console.error(e); }
  }

  // ── Bericht versturen ─────────────────────────────────────────────────────
  function sendMessage() {
    if (!text.trim() || !activeConv) return;
    const msg = {
      convId:      activeConv.id,
      senderId:    user.uid,
      senderName:  user.displayName || user.email,
      text:        text.trim(),
      createdAt:   new Date().toISOString(),
    };
    socket?.emit('message:send', { convId: activeConv.id, message: msg });
    setText('');
    stopTyping();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  // ── Typen ─────────────────────────────────────────────────────────────────
  function handleTyping(val) {
    setText(val);
    if (!activeConv) return;
    socket?.emit('typing:start', { convId: activeConv.id, uid: user.uid, name: user.displayName });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, 2000);
  }

  function stopTyping() {
    clearTimeout(typingTimer.current);
    if (activeConv) socket?.emit('typing:stop', { convId: activeConv.id, uid: user.uid });
  }

  // ── Gebruiker zoeken + gesprek starten ───────────────────────────────────
  async function searchUser() {
    setSearchErr(''); setSearchResult(null);
    if (!searchEmail.trim()) return;
    try {
      const res  = await fetch(`${BACKEND_URL}/api/users/search?email=${encodeURIComponent(searchEmail.trim())}`);
      const data = await res.json();
      if (res.ok) setSearchResult(data);
      else        setSearchErr(data.error || 'Niet gevonden');
    } catch { setSearchErr('Verbindingsfout'); }
  }

  function startConversationWith(contact) {
    if (!socket) return;
    socket.emit('conversation:create', {
      members:     [user.uid, contact.uid],
      memberNames: { [user.uid]: user.displayName || user.email, [contact.uid]: contact.displayName },
      isGroup: false,
    }, ({ convId, error }) => {
      if (error) return alert(error);
      const conv = { id: convId, members: [user.uid, contact.uid], memberNames: { [user.uid]: user.displayName, [contact.uid]: contact.displayName }, isGroup: false };
      setShowNewChat(false); setSearchEmail(''); setSearchResult(null);
      openConversation(conv);
      loadConversations();
    });
  }

  // ── Bellen ────────────────────────────────────────────────────────────────
  async function initiateCall(isVideo) {
    if (!activeConv) return;
    const toUid = activeConv.members.find(m => m !== user.uid);
    const name  = activeConv.memberNames?.[toUid] || 'Contactpersoon';
    try {
      const localStream = await startCall({
        toUid, fromUid: user.uid, callerName: user.displayName || user.email, isVideo,
        onStream: (remoteStream, localStream) => {
          setActiveCall(prev => ({ ...prev, remoteStream, localStream }));
        },
        onEnd: (reason) => { setActiveCall(null); },
      });
      setActiveCall({ toUid, isVideo, name, localStream, remoteStream: null });
    } catch (e) {
      alert('Kan geen toegang krijgen tot microfoon/camera. Controleer je browserinstellingen.');
    }
  }

  // ── Hulpfuncties ─────────────────────────────────────────────────────────
  function getConvName(conv) {
    if (conv.isGroup) return conv.groupName || 'Groepsgesprek';
    const otherUid = conv.members?.find(m => m !== user.uid);
    return conv.memberNames?.[otherUid] || 'Contactpersoon';
  }

  function getInitials(name) {
    return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  }

  return (
    <div className="app-screen">

      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-top">
            <div className="app-brand"><span className="brand-dot" />Pulse</div>
            <button className="icon-btn" onClick={() => setShowNewChat(true)} title="Nieuw gesprek">✏️</button>
          </div>
          <div className="search-box">
            <span>🔍</span>
            <input placeholder="Zoek gesprekken…" readOnly />
          </div>
        </div>

        <div className="conv-list">
          {conversations.length === 0 && (
            <div className="empty-convs">
              <p>Nog geen gesprekken.</p>
              <p>Klik op ✏️ om iemand te vinden.</p>
            </div>
          )}
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`conv-item ${activeConv?.id === conv.id ? 'active' : ''}`}
              onClick={() => openConversation(conv)}
            >
              <div className="avatar-circle">{getInitials(getConvName(conv))}</div>
              <div className="conv-info">
                <div className="conv-name">{getConvName(conv)}</div>
                <div className="conv-preview">{conv.lastMessage || 'Start een gesprek…'}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-chip-avatar">{getInitials(user.displayName || user.email)}</div>
            <div className="user-chip-info">
              <div className="user-chip-name">{user.displayName || user.email.split('@')[0]}</div>
              <div className="user-chip-status">● Online</div>
            </div>
          </div>
          <button className="icon-btn danger" onClick={() => signOut(auth)} title="Uitloggen">↩</button>
        </div>
      </aside>

      {/* ── CHAT ── */}
      <main className="chat-main">
        {!activeConv ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <div className="empty-title">Kies een gesprek</div>
            <p>Of klik op ✏️ om een nieuwe chat te beginnen.</p>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <div className="avatar-circle sm">{getInitials(getConvName(activeConv))}</div>
              <div className="chat-header-info">
                <div className="chat-header-name">{getConvName(activeConv)}</div>
                {typing && <div className="chat-header-typing">● {typingName} typt…</div>}
              </div>
              <div className="chat-header-actions">
                <button className="call-btn voice" onClick={() => initiateCall(false)} title="Bellen">📞</button>
                <button className="call-btn video" onClick={() => initiateCall(true)}  title="Videobellen">🎥</button>
              </div>
            </div>

            <div className="messages-area">
              {messages.map((msg, i) => (
                <div key={msg.id || i} className={`msg-group ${msg.senderId === user.uid ? 'out' : 'in'}`}>
                  {msg.senderId !== user.uid && activeConv.isGroup && (
                    <div className="msg-sender">{msg.senderName}</div>
                  )}
                  <div className="msg-bubble">{msg.text}</div>
                  <div className="msg-time">{formatTime(msg.createdAt)}</div>
                </div>
              ))}
              <div ref={msgEndRef} />
            </div>

            <div className="chat-input-area">
              <div className="input-row">
                <textarea
                  className="chat-textarea"
                  rows={1}
                  placeholder="Stuur een bericht…"
                  value={text}
                  onChange={e => handleTyping(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button className="send-btn" onClick={sendMessage}>➤</button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── NIEUW GESPREK MODAL ── */}
      {showNewChat && (
        <div className="modal-overlay" onClick={() => setShowNewChat(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">✏️ Nieuwe chat</h3>
            <p className="modal-sub">Zoek iemand op e-mailadres</p>
            <div className="search-row">
              <input
                className="form-input"
                type="email"
                placeholder="naam@voorbeeld.nl"
                value={searchEmail}
                onChange={e => setSearchEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchUser()}
              />
              <button className="btn-primary sm" onClick={searchUser}>Zoeken</button>
            </div>
            {searchErr && <div className="auth-error">⚠️ {searchErr}</div>}
            {searchResult && (
              <div className="search-result" onClick={() => startConversationWith(searchResult)}>
                <div className="avatar-circle sm">{getInitials(searchResult.displayName)}</div>
                <div>
                  <div className="conv-name">{searchResult.displayName}</div>
                  <div className="conv-preview">{searchResult.email}</div>
                </div>
              </div>
            )}
            <button className="btn-secondary" onClick={() => setShowNewChat(false)}>Sluiten</button>
          </div>
        </div>
      )}

      {/* ── ACTIEF GESPREK OVERLAY ── */}
      {activeCall && (
        <CallOverlay
          active={activeCall}
          user={user}
          onEnd={() => { endCall(activeCall.toUid); setActiveCall(null); }}
        />
      )}
    </div>
  );
}
