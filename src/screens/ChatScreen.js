// src/screens/ChatScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { getSocket, BACKEND_URL, startCall, endCall } from '../services/socket';
import CallOverlay from '../components/CallOverlay';

export default function ChatScreen({ user }) {
  const [conversations,  setConversations]  = useState([]);
  const [activeConv,     setActiveConv]     = useState(null);
  const [messages,       setMessages]       = useState([]);
  const [text,           setText]           = useState('');
  const [typing,         setTyping]         = useState(false);
  const [typingName,     setTypingName]     = useState('');
  const [activeCall,     setActiveCall]     = useState(null);

  // Schermen: 'chats' | 'contacts'
  const [activeTab,      setActiveTab]      = useState('chats');

  // Contacten
  const [contacts,       setContacts]       = useState([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactEmail,   setContactEmail]   = useState('');
  const [contactErr,     setContactErr]     = useState('');
  const [contactLoading, setContactLoading] = useState(false);

  // Nieuw gesprek
  const [showNewChat,    setShowNewChat]    = useState(false);
  const [searchEmail,    setSearchEmail]    = useState('');
  const [searchResult,   setSearchResult]  = useState(null);
  const [searchErr,      setSearchErr]     = useState('');

  const msgEndRef   = useRef(null);
  const typingTimer = useRef(null);
  const socket      = getSocket();

  // ── Gesprekken laden ──────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const res  = await fetch(`${BACKEND_URL}/api/conversations/${user.uid}`);
      const data = await res.json();
      setConversations(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  }, [user.uid]);

  // ── Contacten laden uit Firestore ─────────────────────────────────────────
  const loadContacts = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'contacts'));
      setContacts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  }, [user.uid]);

  useEffect(() => { loadConversations(); loadContacts(); }, [loadConversations, loadContacts]);

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
      else setTyping(false);
    });
    return () => { socket.off('message:received'); socket.off('typing:update'); };
  }, [socket, loadConversations]);

  // ── Gesprek openen ────────────────────────────────────────────────────────
  async function openConversation(conv) {
    setActiveConv(conv);
    setActiveTab('chats');
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
      convId:     activeConv.id,
      senderId:   user.uid,
      senderName: user.displayName || user.email,
      text:       text.trim(),
      createdAt:  new Date().toISOString(),
    };
    socket?.emit('message:send', { convId: activeConv.id, message: msg });
    setText('');
    stopTyping();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

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

  // ── Contact toevoegen ─────────────────────────────────────────────────────
  async function addContact() {
    setContactErr(''); setContactLoading(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/api/users/search?email=${encodeURIComponent(contactEmail.trim())}`);
      const data = await res.json();
      if (!res.ok) { setContactErr(data.error || 'Gebruiker niet gevonden'); return; }
      if (data.uid === user.uid) { setContactErr('Je kunt jezelf niet toevoegen'); return; }

      // Opslaan in Firestore onder users/{uid}/contacts
      await setDoc(doc(db, 'users', user.uid, 'contacts', data.uid), {
        uid:         data.uid,
        displayName: data.displayName,
        email:       data.email,
        addedAt:     new Date().toISOString(),
      });

      setContacts(prev => [...prev.filter(c => c.uid !== data.uid), { uid: data.uid, displayName: data.displayName, email: data.email }]);
      setContactEmail('');
      setShowAddContact(false);
    } catch (e) { setContactErr('Verbindingsfout'); }
    finally { setContactLoading(false); }
  }

  // ── Contact verwijderen ───────────────────────────────────────────────────
  async function removeContact(uid) {
    await deleteDoc(doc(db, 'users', user.uid, 'contacts', uid));
    setContacts(prev => prev.filter(c => c.uid !== uid));
  }

  // ── Gesprek starten vanuit contacten ──────────────────────────────────────
  function startChatWithContact(contact) {
    if (!socket) return;
    socket.emit('conversation:create', {
      members:     [user.uid, contact.uid],
      memberNames: { [user.uid]: user.displayName || user.email, [contact.uid]: contact.displayName },
      isGroup: false,
    }, ({ convId, error }) => {
      if (error) return alert(error);
      const conv = { id: convId, members: [user.uid, contact.uid], memberNames: { [user.uid]: user.displayName, [contact.uid]: contact.displayName }, isGroup: false };
      openConversation(conv);
      loadConversations();
    });
  }

  // ── Gebruiker zoeken ──────────────────────────────────────────────────────
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
      await startCall({
        toUid, fromUid: user.uid, callerName: user.displayName || user.email, isVideo,
        onStream: (remoteStream, localStream) => {
          setActiveCall(prev => ({ ...prev, remoteStream, localStream }));
        },
        onEnd: () => setActiveCall(null),
      });
      setActiveCall({ toUid, isVideo, name, localStream: null, remoteStream: null });
    } catch (e) {
      alert('Kan geen toegang krijgen tot microfoon/camera.');
    }
  }

  // ── Hulpfuncties ──────────────────────────────────────────────────────────
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
        </div>

        {/* Tabs: Chats / Contacten */}
        <div className="sidebar-tabs">
          <button className={`sidebar-tab ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => setActiveTab('chats')}>💬 Chats</button>
          <button className={`sidebar-tab ${activeTab === 'contacts' ? 'active' : ''}`} onClick={() => setActiveTab('contacts')}>👥 Contacten</button>
        </div>

        {/* ── CHATS TAB ── */}
        {activeTab === 'chats' && (
          <div className="conv-list">
            {conversations.length === 0 && (
              <div className="empty-convs">
                <p>Nog geen gesprekken.</p>
                <p>Klik op ✏️ om iemand te vinden.</p>
              </div>
            )}
            {conversations.map(conv => (
              <div key={conv.id} className={`conv-item ${activeConv?.id === conv.id ? 'active' : ''}`} onClick={() => openConversation(conv)}>
                <div className="avatar-circle">{getInitials(getConvName(conv))}</div>
                <div className="conv-info">
                  <div className="conv-name">{getConvName(conv)}</div>
                  <div className="conv-preview">{conv.lastMessage || 'Start een gesprek…'}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── CONTACTEN TAB ── */}
        {activeTab === 'contacts' && (
          <div className="conv-list">
            <div style={{ padding: '12px 18px' }}>
              <button className="btn-primary" style={{ padding: '10px', fontSize: '13px' }} onClick={() => setShowAddContact(true)}>
                + Contact toevoegen
              </button>
            </div>

            {contacts.length === 0 && (
              <div className="empty-convs">
                <p>Nog geen contacten.</p>
                <p>Voeg iemand toe via e-mailadres.</p>
              </div>
            )}

            {contacts.map(contact => (
              <div key={contact.uid} className="conv-item">
                <div className="avatar-circle">{getInitials(contact.displayName)}</div>
                <div className="conv-info">
                  <div className="conv-name">{contact.displayName}</div>
                  <div className="conv-preview">{contact.email}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button className="call-btn voice" onClick={() => startChatWithContact(contact)} title="Stuur bericht" style={{ fontSize: '14px' }}>💬</button>
                  <button className="icon-btn" onClick={() => removeContact(contact.uid)} title="Verwijderen" style={{ color: 'var(--danger)' }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}

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

      {/* ── CHAT MAIN ── */}
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
                <button className="call-btn video" onClick={() => initiateCall(true)} title="Videobellen">🎥</button>
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
                  className="chat-textarea" rows={1}
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

      {/* ── CONTACT TOEVOEGEN MODAL ── */}
      {showAddContact && (
        <div className="modal-overlay" onClick={() => setShowAddContact(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">👥 Contact toevoegen</h3>
            <p className="modal-sub">Zoek iemand op e-mailadres</p>
            <div className="form-group">
              <input
                className="form-input" type="email"
                placeholder="naam@voorbeeld.nl"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addContact()}
              />
            </div>
            {contactErr && <div className="auth-error">⚠️ {contactErr}</div>}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { setShowAddContact(false); setContactEmail(''); setContactErr(''); }}>Annuleren</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={addContact} disabled={contactLoading}>
                {contactLoading ? 'Zoeken…' : 'Toevoegen →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NIEUW GESPREK MODAL ── */}
      {showNewChat && (
        <div className="modal-overlay" onClick={() => setShowNewChat(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">✏️ Nieuwe chat</h3>

            {/* Contacten als snelkoppeling */}
            {contacts.length > 0 && (
              <>
                <p className="modal-sub">Kies uit je contacten</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  {contacts.map(c => (
                    <div key={c.uid} className="search-result" onClick={() => startConversationWith(c)}>
                      <div className="avatar-circle sm">{getInitials(c.displayName)}</div>
                      <div>
                        <div className="conv-name">{c.displayName}</div>
                        <div className="conv-preview">{c.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <p className="modal-sub">Of zoek op e-mailadres</p>
            <div className="search-row">
              <input
                className="form-input" type="email"
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
