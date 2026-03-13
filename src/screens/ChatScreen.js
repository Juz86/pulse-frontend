// src/screens/ChatScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { signOut, updateProfile as fbUpdateProfile } from 'firebase/auth';
import { auth, db, storage } from '../firebase';
import { doc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getSocket, BACKEND_URL, startCall } from '../services/socket';
import CallOverlay from '../components/CallOverlay';

const MSG_LIMIT = 30;

export default function ChatScreen({ user, onlineUsers = new Set() }) {
  const [conversations,  setConversations]  = useState([]);
  const [activeConv,     setActiveConv]     = useState(null);
  const [messages,       setMessages]       = useState([]);
  const [text,           setText]           = useState('');
  const [typing,         setTyping]         = useState(false);
  const [typingName,     setTypingName]     = useState('');
  const [activeCall,     setActiveCall]     = useState(null);
  const [unreadCounts,   setUnreadCounts]   = useState({});
  const [connected,      setConnected]      = useState(true);
  const [hasMore,        setHasMore]        = useState(false);
  const [loadingMore,    setLoadingMore]    = useState(false);
  const [msgOffset,      setMsgOffset]      = useState(0);
  const [readConvs,      setReadConvs]      = useState(new Set()); // convIds die de ontvanger heeft gelezen

  // Schermen: 'chats' | 'contacts'
  const [activeTab,      setActiveTab]      = useState('chats');
  const [searchQuery,    setSearchQuery]    = useState('');

  // Contacten
  const [contacts,         setContacts]         = useState([]);
  const [showAddContact,   setShowAddContact]   = useState(false);
  const [contactEmail,     setContactEmail]     = useState('');
  const [contactErr,       setContactErr]       = useState('');
  const [contactLoading,   setContactLoading]   = useState(false);
  const [friendRequests,   setFriendRequests]   = useState([]);
  const [contactSuccess,   setContactSuccess]   = useState('');

  // Nieuw gesprek
  const [showNewChat,    setShowNewChat]    = useState(false);
  const [searchEmail,    setSearchEmail]    = useState('');
  const [searchResult,   setSearchResult]  = useState(null);
  const [searchErr,      setSearchErr]     = useState('');

  // Oproepen modal
  const [showCallModal,  setShowCallModal]  = useState(false);

  // Groepsinformatie
  const [showGroupInfo,  setShowGroupInfo]  = useState(false);
  const [addingMember,   setAddingMember]   = useState(false);

  // Contactprofiel
  const [showContactProfile, setShowContactProfile] = useState(false);

  // Groep aanmaken
  const [showNewGroup,   setShowNewGroup]   = useState(false);
  const [groupName,      setGroupName]      = useState('');
  const [groupMembers,   setGroupMembers]   = useState([]);

  // Profiel
  const [showProfile,    setShowProfile]    = useState(false);
  const [newName,        setNewName]        = useState(user.displayName || '');
  const [photoFile,      setPhotoFile]      = useState(null);
  const [photoPreview,   setPhotoPreview]   = useState(user.photoURL || null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg,     setProfileMsg]     = useState('');

  const msgEndRef     = useRef(null);
  const msgsAreaRef   = useRef(null);
  const textareaRef   = useRef(null);
  const typingTimer   = useRef(null);
  const activeConvRef = useRef(null);
  const photoInputRef = useRef(null);
  const socket        = getSocket();

  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);

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

  // ── Vriendschapsverzoeken laden ───────────────────────────────────────────
  const loadFriendRequests = useCallback(async () => {
    try {
      const res  = await fetch(`${BACKEND_URL}/api/friend-requests/${user.uid}`);
      const data = await res.json();
      setFriendRequests(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  }, [user.uid]);

  useEffect(() => { loadConversations(); loadContacts(); loadFriendRequests(); }, [loadConversations, loadContacts, loadFriendRequests]);

  // Typing timer opruimen bij unmount
  useEffect(() => () => clearTimeout(typingTimer.current), []);

  // ── Socket events ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onMessageReceived = (msg) => {
      const current = activeConvRef.current;
      if (current?.id === msg.convId) {
        setMessages(prev => {
          // Voorkom duplicaten als bericht al aanwezig is
          if (prev.some(m => m.id && m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => { if (msgsAreaRef.current) msgsAreaRef.current.scrollTo({ top: msgsAreaRef.current.scrollHeight, behavior: 'smooth' }); }, 50);
        playMessageSound();
      } else {
        setUnreadCounts(prev => ({ ...prev, [msg.convId]: (prev[msg.convId] || 0) + 1 }));
        if (Notification.permission === 'granted' && document.hidden) {
          new Notification(msg.senderName || 'Nieuw bericht', { body: msg.text, icon: '/logo192.png' });
        }
        playMessageSound();
      }
      loadConversations();
    };

    const onTypingUpdate = ({ typing, name }) => {
      if (typing) { setTyping(true); setTypingName(name || 'Iemand'); }
      else setTyping(false);
    };

    const onMessageStatus = ({ convId, status }) => {
      if (status === 'read') setReadConvs(prev => new Set([...prev, convId]));
    };

    const onFriendRequest = (req) => {
      setFriendRequests(prev => [req, ...prev.filter(r => r.id !== req.id)]);
      if (Notification.permission === 'granted') {
        new Notification('Nieuw vriendschapsverzoek', { body: `${req.fromName} wil je toevoegen`, icon: '/logo192.png' });
      }
    };

    const onFriendAccepted = ({ byName }) => {
      loadContacts();
      setContactSuccess(`${byName} heeft je vriendschapsverzoek geaccepteerd!`);
      setTimeout(() => setContactSuccess(''), 4000);
    };

    socket.on('connect',          onConnect);
    socket.on('disconnect',       onDisconnect);
    socket.on('message:received', onMessageReceived);
    socket.on('typing:update',    onTypingUpdate);
    socket.on('message:status',   onMessageStatus);
    socket.on('friend:request',   onFriendRequest);
    socket.on('friend:accepted',  onFriendAccepted);

    return () => {
      socket.off('connect',          onConnect);
      socket.off('disconnect',       onDisconnect);
      socket.off('message:received', onMessageReceived);
      socket.off('typing:update',    onTypingUpdate);
      socket.off('message:status',   onMessageStatus);
      socket.off('friend:request',   onFriendRequest);
      socket.off('friend:accepted',  onFriendAccepted);
    };
  }, [socket, loadConversations, loadContacts]);

  // ── Escape sluit modals ───────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== 'Escape') return;
      if (showAddContact) { setShowAddContact(false); setContactEmail(''); setContactErr(''); }
      else if (showNewChat)   { setShowNewChat(false); setSearchEmail(''); setSearchResult(null); }
      else if (showNewGroup)  { setShowNewGroup(false); setGroupName(''); setGroupMembers([]); }
      else if (showProfile)   setShowProfile(false);
      else if (showCallModal) setShowCallModal(false);
      else if (showGroupInfo) { setShowGroupInfo(false); setAddingMember(false); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showAddContact, showNewChat, showNewGroup, showProfile, showCallModal, showGroupInfo]);

  // ── Berichtengeluid (4) ───────────────────────────────────────────────────
  function playMessageSound() {
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
      osc.onended = () => ctx.close();
    } catch {}
  }

  // ── Gesprek verwijderen ───────────────────────────────────────────────────
  async function deleteConversation(e, convId) {
    e.stopPropagation();
    if (!window.confirm('Weet je zeker dat je dit gesprek wilt verwijderen?')) return;
    try {
      await fetch(`${BACKEND_URL}/api/conversations/${convId}?uid=${user.uid}`, { method: 'DELETE' });
    } catch (e) { console.error(e); }
    setConversations(prev => prev.filter(c => c.id !== convId));
    if (activeConv?.id === convId) { setActiveConv(null); setMessages([]); }
  }

  // ── Gesprek openen ────────────────────────────────────────────────────────
  async function openConversation(conv) {
    const convId = conv.id;
    setActiveConv(conv);
    activeConvRef.current = conv; // direct updaten zodat socket events meteen de juiste conv kennen
    setActiveTab('chats');
    setMessages([]);
    setMsgOffset(0);
    setHasMore(false);
    setUnreadCounts(prev => { const n = { ...prev }; delete n[conv.id]; return n; });
    socket?.emit('conversation:join', { convId: conv.id });
    socket?.emit('messages:read', { convId: conv.id, uid: user.uid });
    try {
      const res  = await fetch(`${BACKEND_URL}/api/messages/${conv.id}?limit=${MSG_LIMIT}&offset=0&uid=${user.uid}`);
      const data = await res.json();
      const arr  = Array.isArray(data) ? data : [];
      // Alleen updaten als gebruiker nog in hetzelfde gesprek zit
      if (activeConvRef.current?.id !== convId) return;
      setMessages(prev => {
        // Bewaar berichten die tijdens de fetch binnenkwamen (niet in DB-resultaat)
        const fetchedIds = new Set(arr.map(m => m.id).filter(Boolean));
        const live = prev.filter(m => m.id && !fetchedIds.has(m.id));
        return [...arr, ...live];
      });
      setMsgOffset(arr.length);
      setHasMore(arr.length === MSG_LIMIT);
      setTimeout(() => { if (msgsAreaRef.current) msgsAreaRef.current.scrollTop = msgsAreaRef.current.scrollHeight; }, 100);
    } catch (e) { console.error(e); }
  }

  // ── Meer berichten laden (5) ──────────────────────────────────────────────
  async function loadMoreMessages() {
    if (!activeConv || loadingMore) return;
    setLoadingMore(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/api/messages/${activeConv.id}?limit=${MSG_LIMIT}&offset=${msgOffset}`);
      const data = await res.json();
      const arr  = Array.isArray(data) ? data : [];
      setMessages(prev => [...arr, ...prev]);
      setMsgOffset(prev => prev + arr.length);
      setHasMore(arr.length === MSG_LIMIT);
    } catch (e) { console.error(e); }
    finally { setLoadingMore(false); }
  }

  // ── Bericht versturen ─────────────────────────────────────────────────────
  function sendMessage() {
    if (!text.trim() || !activeConv) return;
    if (!socket?.connected) {
      alert('Geen verbinding. Controleer je internet en probeer opnieuw.');
      return;
    }
    const msg = {
      convId:     activeConv.id,
      senderId:   user.uid,
      senderName: user.displayName || user.email,
      text:       text.trim(),
      createdAt:  new Date().toISOString(),
    };
    socket.emit('message:send', { convId: activeConv.id, message: msg });
    setText('');
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
    stopTyping();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function handleTyping(val) {
    setText(val);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
    if (!activeConv) return;
    socket?.emit('typing:start', { convId: activeConv.id, uid: user.uid, name: user.displayName });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, 2000);
  }

  function stopTyping() {
    clearTimeout(typingTimer.current);
    if (activeConv) socket?.emit('typing:stop', { convId: activeConv.id, uid: user.uid });
  }

  // ── Vriendschapsverzoek sturen ────────────────────────────────────────────
  async function addContact() {
    setContactErr(''); setContactLoading(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/api/friend-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUid:   user.uid,
          fromName:  user.displayName || user.email,
          fromEmail: user.email,
          fromPhoto: user.photoURL || null,
          toEmail:   contactEmail.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setContactErr(data.error || 'Fout bij verzenden'); return; }
      setContactEmail('');
      setShowAddContact(false);
      setContactSuccess('Vriendschapsverzoek verzonden!');
      setTimeout(() => setContactSuccess(''), 4000);
    } catch (e) { console.error('addContact fout:', e); setContactErr('Verbindingsfout'); }
    finally { setContactLoading(false); }
  }

  // ── Vriendschapsverzoek accepteren ────────────────────────────────────────
  async function acceptFriendRequest(requestId) {
    try {
      await fetch(`${BACKEND_URL}/api/friend-requests/${requestId}/accept`, { method: 'POST' });
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
      loadContacts();
    } catch (e) { console.error(e); }
  }

  // ── Vriendschapsverzoek weigeren ──────────────────────────────────────────
  async function declineFriendRequest(requestId) {
    try {
      await fetch(`${BACKEND_URL}/api/friend-requests/${requestId}/decline`, { method: 'POST' });
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (e) { console.error(e); }
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
      members:      [user.uid, contact.uid],
      memberNames:  { [user.uid]: user.displayName || user.email, [contact.uid]: contact.displayName },
      memberEmails: { [user.uid]: user.email, [contact.uid]: contact.email },
      isGroup: false,
    }, ({ convId, error }) => {
      if (error) return alert(error);
      const conv = { id: convId, members: [user.uid, contact.uid], memberNames: { [user.uid]: user.displayName, [contact.uid]: contact.displayName }, memberEmails: { [user.uid]: user.email, [contact.uid]: contact.email }, isGroup: false };
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
      members:      [user.uid, contact.uid],
      memberNames:  { [user.uid]: user.displayName || user.email, [contact.uid]: contact.displayName },
      memberEmails: { [user.uid]: user.email, [contact.uid]: contact.email },
      isGroup: false,
    }, ({ convId, error }) => {
      if (error) return alert(error);
      const conv = { id: convId, members: [user.uid, contact.uid], memberNames: { [user.uid]: user.displayName, [contact.uid]: contact.displayName }, memberEmails: { [user.uid]: user.email, [contact.uid]: contact.email }, isGroup: false };
      setShowNewChat(false); setSearchEmail(''); setSearchResult(null);
      openConversation(conv);
      loadConversations();
    });
  }

  // ── Groepslid toevoegen ───────────────────────────────────────────────────
  function addMemberToGroup(contact) {
    if (!socket || !activeConv) return;
    socket.emit('conversation:addMember', {
      convId: activeConv.id, uid: contact.uid, displayName: contact.displayName,
    }, (res = {}) => {
      if (res.error) return alert(res.error);
      setActiveConv(prev => ({
        ...prev,
        members:     [...prev.members, contact.uid],
        memberNames: { ...prev.memberNames, [contact.uid]: contact.displayName },
      }));
      setAddingMember(false);
    });
  }

  // ── Groepslid verwijderen ─────────────────────────────────────────────────
  function removeMemberFromGroup(uid) {
    if (!socket || !activeConv) return;
    if (!window.confirm('Weet je zeker dat je deze persoon wilt verwijderen uit de groep?')) return;
    socket.emit('conversation:removeMember', { convId: activeConv.id, uid }, (res = {}) => {
      if (res.error) return alert(res.error);
      setActiveConv(prev => {
        const members     = prev.members.filter(m => m !== uid);
        const memberNames = { ...prev.memberNames };
        delete memberNames[uid];
        return { ...prev, members, memberNames };
      });
    });
  }

  // ── Groep aanmaken ────────────────────────────────────────────────────────
  function createGroup() {
    if (!socket || !groupName.trim() || groupMembers.length === 0) return;
    const memberUids  = [user.uid, ...groupMembers.map(c => c.uid)];
    const memberNames = { [user.uid]: user.displayName || user.email };
    groupMembers.forEach(c => { memberNames[c.uid] = c.displayName; });
    socket.emit('conversation:create', {
      members: memberUids, memberNames, isGroup: true, groupName: groupName.trim(),
    }, ({ convId, error }) => {
      if (error) return alert(error);
      const conv = { id: convId, members: memberUids, memberNames, isGroup: true, groupName: groupName.trim() };
      setShowNewGroup(false); setGroupName(''); setGroupMembers([]);
      openConversation(conv);
      loadConversations();
    });
  }

  function toggleGroupMember(contact) {
    setGroupMembers(prev =>
      prev.find(c => c.uid === contact.uid)
        ? prev.filter(c => c.uid !== contact.uid)
        : [...prev, contact]
    );
  }

  // ── Profielfoto selecteren (6) ────────────────────────────────────────────
  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    e.target.value = ''; // reset zodat hetzelfde bestand opnieuw gekozen kan worden
  }

  // ── Profiel opslaan (6) ───────────────────────────────────────────────────
  async function saveProfile(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setProfileLoading(true); setProfileMsg('');
    try {
      let photoURL = user.photoURL || null;
      if (photoFile) {
        const fileRef = storageRef(storage, `avatars/${user.uid}`);
        await uploadBytes(fileRef, photoFile);
        photoURL = await getDownloadURL(fileRef);
      }
      await fbUpdateProfile(auth.currentUser, { displayName: newName.trim(), photoURL });
      setPhotoFile(null);
      setProfileMsg('Opgeslagen!');
    } catch { setProfileMsg('Fout bij opslaan.'); }
    finally { setProfileLoading(false); }
  }

  // ── Bellen vanuit oproepen-modal ─────────────────────────────────────────
  async function callContact(contact, isVideo) {
    setShowCallModal(false);
    const toUid = contact.uid;
    const name  = contact.displayName;
    const stream = await startCall({
      toUid, fromUid: user.uid, callerName: user.displayName || user.email, isVideo,
      onStream: (remoteStream, localStream) => {
        setActiveCall(prev => ({ ...prev, remoteStream, localStream }));
      },
      onEnd: () => setActiveCall(null),
    });
    if (stream) setActiveCall({ toUid, isVideo, name, localStream: null, remoteStream: null });
  }

  // ── Bellen ────────────────────────────────────────────────────────────────
  async function initiateCall(isVideo) {
    if (!activeConv || !Array.isArray(activeConv.members)) return;
    const toUid = activeConv.members.find(m => m !== user.uid);
    if (!toUid) return;
    const name  = activeConv.memberNames?.[toUid] || 'Contactpersoon';
    const stream = await startCall({
      toUid, fromUid: user.uid, callerName: user.displayName || user.email, isVideo,
      onStream: (remoteStream, localStream) => {
        setActiveCall(prev => ({ ...prev, remoteStream, localStream }));
      },
      onEnd: () => setActiveCall(null),
    });
    if (stream) setActiveCall({ toUid, isVideo, name, localStream: null, remoteStream: null });
  }

  // ── Hulpfuncties ──────────────────────────────────────────────────────────
  function getConvName(conv) {
    if (conv.isGroup) return conv.groupName || 'Groepsgesprek';
    const otherUid = conv.members?.find(m => m !== user.uid);
    return conv.memberNames?.[otherUid] || 'Contactpersoon';
  }

  function getOtherUid(conv) {
    if (conv?.isGroup) return null;
    return conv?.members?.find(m => m !== user.uid);
  }

  function getConvPhoto(conv) {
    if (conv.isGroup) return null;
    const otherUid = getOtherUid(conv);
    return contacts.find(c => c.uid === otherUid)?.photoURL || null;
  }

  function getInitials(name) {
    return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  function parseDate(val) {
    if (!val) return null;
    if (val._seconds) return new Date(val._seconds * 1000);
    const d = new Date(val);
    return isNaN(d) ? null : d;
  }

  function formatTime(val) {
    const d = parseDate(val);
    if (!d) return '';
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  }

  function formatDateLabel(val) {
    const d = parseDate(val);
    if (!d) return '';
    const now       = new Date();
    const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today - 86400000);
    const msgDay    = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (msgDay.getTime() === today.getTime())     return 'Vandaag';
    if (msgDay.getTime() === yesterday.getTime()) return 'Gisteren';
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function renderMessages() {
    const items = [];
    let lastDate = null;
    const isConvRead = readConvs.has(activeConv?.id);
    messages.forEach((msg, i) => {
      const label = formatDateLabel(msg.createdAt);
      if (label !== lastDate) {
        lastDate = label;
        items.push(<div key={`date-${i}`} className="msg-date-sep"><span>{label}</span></div>);
      }
      const isOwn = msg.senderId === user.uid;
      items.push(
        <div key={msg.id || i} className={`msg-group ${isOwn ? 'out' : 'in'}`}>
          {!isOwn && activeConv.isGroup && <div className="msg-sender">{msg.senderName}</div>}
          <div className="msg-bubble">{msg.text}</div>
          <div className="msg-time">
            {formatTime(msg.createdAt)}
            {isOwn && (
              <span className={`msg-ticks ${isConvRead ? 'read' : ''}`}>
                {isConvRead ? '✓✓' : '✓'}
              </span>
            )}
          </div>
        </div>
      );
    });
    return items;
  }

  // ── Avatar helper ─────────────────────────────────────────────────────────
  function UserAvatar({ photoURL, displayName, className = '' }) {
    if (photoURL) return <img src={photoURL} alt="" className={`avatar-circle ${className}`} style={{ objectFit:'cover' }} />;
    return <div className={`avatar-circle ${className}`}>{getInitials(displayName)}</div>;
  }

  return (
    <div className="app-screen">

      {/* ── VERBINDINGSBANNER (10) ── */}
      {!connected && (
        <div className="connection-banner">
          Verbinding verbroken — opnieuw verbinden…
        </div>
      )}

      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-top">
            <div className="app-brand"><span className="brand-dot" />Pulse</div>
            <div style={{ display:'flex', gap:'6px' }}>
              <button className="icon-btn" onClick={() => setShowCallModal(true)} title="Oproepen">📞</button>
              <button className="icon-btn" onClick={() => setShowNewGroup(true)} title="Nieuwe groep">👥</button>
              <button className="icon-btn" onClick={() => setShowNewChat(true)} title="Nieuw gesprek">✏️</button>
            </div>
          </div>
          <div className="search-box">
            <span style={{ color:'var(--text3)', fontSize:'14px' }}>🔍</span>
            <input
              placeholder="Zoeken…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="sidebar-tabs">
          <button className={`sidebar-tab ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => { setActiveTab('chats'); setSearchQuery(''); }}>💬 Chats</button>
          <button className={`sidebar-tab ${activeTab === 'contacts' ? 'active' : ''}`} onClick={() => { setActiveTab('contacts'); setSearchQuery(''); }}>
            👥 Contacten{friendRequests.length > 0 && <span className="unread-badge" style={{ marginLeft: '6px', fontSize: '11px', padding: '1px 6px' }}>{friendRequests.length}</span>}
          </button>
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
            {conversations.filter(conv =>
              !searchQuery.trim() ||
              getConvName(conv).toLowerCase().includes(searchQuery.toLowerCase()) ||
              (conv.lastMessage || '').toLowerCase().includes(searchQuery.toLowerCase())
            ).map(conv => {
              const otherUid   = getOtherUid(conv);
              const isOnline   = otherUid && onlineUsers.has(otherUid);
              const unread     = unreadCounts[conv.id] || 0;
              return (
                <div key={conv.id} className={`conv-item ${activeConv?.id === conv.id ? 'active' : ''}`} onClick={() => openConversation(conv)}>
                  <div className="avatar-wrap">
                    <UserAvatar photoURL={getConvPhoto(conv)} displayName={getConvName(conv)} />
                    {isOnline && <span className="online-dot" />}
                  </div>
                  <div className="conv-info">
                    <div className="conv-name">{getConvName(conv)}</div>
                    <div className="conv-preview">{conv.lastMessage || 'Start een gesprek…'}</div>
                  </div>
                  {unread > 0 && <span className="unread-badge">{unread}</span>}
                  <button className="conv-delete-btn" onClick={e => deleteConversation(e, conv.id)} title="Verwijderen">🗑️</button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── CONTACTEN TAB ── */}
        {activeTab === 'contacts' && (
          <div className="conv-list">
            <div style={{ padding: '12px 18px' }}>
              <button className="btn-primary" style={{ padding: '10px', fontSize: '13px' }} onClick={() => setShowAddContact(true)}>
                + Contact toevoegen
              </button>
              {contactSuccess && (
                <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: '8px', color: '#4ade80', fontSize: '13px' }}>
                  ✅ {contactSuccess}
                </div>
              )}
            </div>

            {/* Vriendschapsverzoeken */}
            {friendRequests.length > 0 && (
              <div style={{ padding: '0 12px 4px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 6px 8px' }}>
                  Verzoeken ({friendRequests.length})
                </div>
                {friendRequests.map(req => (
                  <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 10px', background: 'rgba(124,111,255,0.08)', borderRadius: '10px', marginBottom: '8px', border: '1px solid rgba(124,111,255,0.2)' }}>
                    <div className="avatar-circle sm">{getInitials(req.fromName)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.fromName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.fromEmail}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                      <button className="btn-primary" style={{ padding: '4px 10px', fontSize: '12px', minWidth: 0 }} onClick={() => acceptFriendRequest(req.id)}>✓</button>
                      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px', minWidth: 0 }} onClick={() => declineFriendRequest(req.id)}>✗</button>
                    </div>
                  </div>
                ))}
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 6px 12px' }} />
              </div>
            )}

            {contacts.length === 0 && friendRequests.length === 0 && (
              <div className="empty-convs">
                <p>Nog geen contacten.</p>
                <p>Voeg iemand toe via e-mailadres.</p>
              </div>
            )}
            {contacts.filter(c =>
              !searchQuery.trim() ||
              c.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              c.email?.toLowerCase().includes(searchQuery.toLowerCase())
            ).map(contact => (
              <div key={contact.uid} className="conv-item">
                <div className="avatar-wrap">
                  <div className="avatar-circle">{getInitials(contact.displayName)}</div>
                  {onlineUsers.has(contact.uid) && <span className="online-dot" />}
                </div>
                <div className="conv-info">
                  <div className="conv-name">{contact.displayName}</div>
                  <div className="conv-preview">{contact.email}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button className="call-btn voice" onClick={() => startChatWithContact(contact)} title="Stuur bericht" style={{ fontSize: '14px' }}>💬</button>
                  <button className="call-btn voice" onClick={() => callContact(contact, false)} title="Bellen">📞</button>
                  <button className="call-btn video" onClick={() => callContact(contact, true)} title="Videobellen">🎥</button>
                  <button className="icon-btn" onClick={() => removeContact(contact.uid)} title="Verwijderen" style={{ color: 'var(--danger)' }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="sidebar-footer">
          <div className="user-chip" style={{ cursor:'pointer' }} onClick={() => { setShowProfile(true); setProfileMsg(''); setNewName(user.displayName || ''); setPhotoPreview(user.photoURL || null); setPhotoFile(null); }}>
            <div className="avatar-wrap" style={{ flexShrink:0 }}>
              <UserAvatar photoURL={user.photoURL} displayName={user.displayName || user.email} className="sm" />
            </div>
            <div className="user-chip-info">
              <div className="user-chip-name">{user.displayName || user.email.split('@')[0]}</div>
              <div className="user-chip-status">Online</div>
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
              <button className="back-btn" onClick={() => setActiveConv(null)} title="Terug">←</button>
              <div className="avatar-wrap" style={{ cursor: !activeConv.isGroup ? 'pointer' : 'default' }} onClick={() => { if (!activeConv.isGroup) setShowContactProfile(true); }}>
                <div className="avatar-circle sm">{getInitials(getConvName(activeConv))}</div>
                {getOtherUid(activeConv) && onlineUsers.has(getOtherUid(activeConv)) && <span className="online-dot sm" />}
              </div>
              <div className="chat-header-info" style={{ cursor: !activeConv.isGroup ? 'pointer' : 'default' }} onClick={() => { if (!activeConv.isGroup) setShowContactProfile(true); }}>
                <div className="chat-header-name">{getConvName(activeConv)}</div>
                {typing
                  ? <div className="chat-header-typing">● {typingName} typt…</div>
                  : getOtherUid(activeConv) && onlineUsers.has(getOtherUid(activeConv))
                    ? <div className="chat-header-online">Online</div>
                    : null
                }
              </div>
              <div className="chat-header-actions">
                {!activeConv.isGroup && (
                  <>
                    <button className="call-btn voice" onClick={() => initiateCall(false)} title="Bellen">📞</button>
                    <button className="call-btn video" onClick={() => initiateCall(true)} title="Videobellen">🎥</button>
                  </>
                )}
                {activeConv.isGroup && (
                  <button className="icon-btn" onClick={() => setShowGroupInfo(true)} title="Groepsinformatie">👥</button>
                )}
              </div>
            </div>

            <div className="messages-area" ref={msgsAreaRef}>
              {/* Meer berichten laden (5) */}
              {hasMore && (
                <div style={{ textAlign:'center', padding:'8px 0' }}>
                  <button className="load-more-btn" onClick={loadMoreMessages} disabled={loadingMore}>
                    {loadingMore ? 'Laden…' : '↑ Meer berichten laden'}
                  </button>
                </div>
              )}
              {renderMessages()}
              <div ref={msgEndRef} />
            </div>

            <div className="chat-input-area">
              <div className="input-row">
                <textarea
                  ref={textareaRef}
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
            <h3 className="modal-title">👥 Vriendschapsverzoek sturen</h3>
            <p className="modal-sub">Voer het e-mailadres in van de persoon die je wilt toevoegen</p>
            <div className="form-group">
              <input className="form-input" type="email" placeholder="naam@voorbeeld.nl" value={contactEmail} onChange={e => setContactEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && addContact()} />
            </div>
            {contactErr && <div className="auth-error">⚠️ {contactErr}</div>}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { setShowAddContact(false); setContactEmail(''); setContactErr(''); }}>Annuleren</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={addContact} disabled={contactLoading}>{contactLoading ? 'Verzenden…' : 'Verzoek sturen →'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── NIEUW GESPREK MODAL ── */}
      {showNewChat && (
        <div className="modal-overlay" onClick={() => setShowNewChat(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">✏️ Nieuwe chat</h3>
            {contacts.length > 0 && (
              <>
                <p className="modal-sub">Kies uit je contacten</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  {contacts.map(c => (
                    <div key={c.uid} className="search-result" onClick={() => startConversationWith(c)}>
                      <div className="avatar-circle sm">{getInitials(c.displayName)}</div>
                      <div><div className="conv-name">{c.displayName}</div><div className="conv-preview">{c.email}</div></div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <p className="modal-sub">Of zoek op e-mailadres</p>
            <div className="search-row">
              <input className="form-input" type="email" placeholder="naam@voorbeeld.nl" value={searchEmail} onChange={e => setSearchEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchUser()} />
              <button className="btn-primary sm" onClick={searchUser}>Zoeken</button>
            </div>
            {searchErr && <div className="auth-error">⚠️ {searchErr}</div>}
            {searchResult && (
              <div className="search-result" onClick={() => startConversationWith(searchResult)}>
                <div className="avatar-circle sm">{getInitials(searchResult.displayName)}</div>
                <div><div className="conv-name">{searchResult.displayName}</div><div className="conv-preview">{searchResult.email}</div></div>
              </div>
            )}
            <button className="btn-secondary" onClick={() => setShowNewChat(false)}>Sluiten</button>
          </div>
        </div>
      )}

      {/* ── GROEP AANMAKEN MODAL ── */}
      {showNewGroup && (
        <div className="modal-overlay" onClick={() => setShowNewGroup(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">👥 Nieuwe groep</h3>
            <div className="form-group">
              <label className="form-label">Groepsnaam</label>
              <input className="form-input" placeholder="Bijv. Familie, Werk…" value={groupName} onChange={e => setGroupName(e.target.value)} maxLength={50} />
            </div>
            <p className="modal-sub">Selecteer deelnemers</p>
            {contacts.length === 0 && <div className="auth-error">⚠️ Voeg eerst contacten toe.</div>}
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'16px' }}>
              {contacts.map(c => {
                const selected = groupMembers.find(m => m.uid === c.uid);
                return (
                  <div key={c.uid} className={`search-result ${selected ? 'selected' : ''}`} onClick={() => toggleGroupMember(c)}>
                    <div className="avatar-circle sm">{getInitials(c.displayName)}</div>
                    <div style={{ flex:1 }}><div className="conv-name">{c.displayName}</div><div className="conv-preview">{c.email}</div></div>
                    <span style={{ fontSize:'18px' }}>{selected ? '✅' : '○'}</span>
                  </div>
                );
              })}
            </div>
            {groupMembers.length > 0 && <p className="modal-sub">{groupMembers.length} deelnemer(s) geselecteerd</p>}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { setShowNewGroup(false); setGroupName(''); setGroupMembers([]); }}>Annuleren</button>
              <button className="btn-primary" style={{ flex:1 }} onClick={createGroup} disabled={!groupName.trim() || groupMembers.length === 0}>Groep aanmaken →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PROFIEL MODAL ── */}
      {showProfile && (
        <div className="modal-overlay" onClick={() => setShowProfile(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">⚙️ Mijn profiel</h3>

            {/* Profielfoto (6) */}
            <div style={{ display:'flex', justifyContent:'center', marginBottom:'20px' }}>
              <div className="profile-photo-wrap" onClick={() => photoInputRef.current?.click()}>
                {photoPreview
                  ? <img src={photoPreview} alt="avatar" className="profile-avatar-big" style={{ objectFit:'cover' }} />
                  : <div className="profile-avatar-big">{getInitials(user.displayName || user.email)}</div>
                }
                <div className="profile-photo-overlay">📷</div>
              </div>
              <input ref={photoInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handlePhotoChange} />
            </div>

            <form onSubmit={saveProfile}>
              <div className="form-group">
                <label className="form-label">Weergavenaam</label>
                <input className="form-input" placeholder="Jouw naam" value={newName} onChange={e => setNewName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">E-mailadres</label>
                <input className="form-input" type="email" value={user.email} disabled style={{ opacity:.5 }} />
              </div>
              {profileMsg && (
                <div className={profileMsg.startsWith('Fout') ? 'auth-error' : 'auth-success'}>{profileMsg}</div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowProfile(false)}>Sluiten</button>
                <button type="submit" className="btn-primary" style={{ flex:1 }} disabled={profileLoading}>{profileLoading ? 'Opslaan…' : 'Opslaan →'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CONTACTPROFIEL MODAL ── */}
      {showContactProfile && activeConv && !activeConv.isGroup && (() => {
        const uid       = getOtherUid(activeConv);
        const name      = getConvName(activeConv);
        const email     = activeConv.memberEmails?.[uid] || contacts.find(c => c.uid === uid)?.email || '';
        const photo     = getConvPhoto(activeConv);
        const isOnline  = uid && onlineUsers.has(uid);
        return (
          <div className="modal-overlay" onClick={() => setShowContactProfile(false)}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <h3 className="modal-title">👤 Profiel</h3>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:'20px' }}>
                {photo
                  ? <img src={photo} alt="" className="profile-avatar-big" style={{ objectFit:'cover' }} />
                  : <div className="profile-avatar-big">{getInitials(name)}</div>
                }
              </div>
              <div className="form-group">
                <label className="form-label">Naam</label>
                <input className="form-input" value={name} disabled style={{ opacity:.7 }} />
              </div>
              {email && (
                <div className="form-group">
                  <label className="form-label">E-mailadres</label>
                  <input className="form-input" value={email} disabled style={{ opacity:.7 }} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Status</label>
                <input className="form-input" value={isOnline ? '🟢 Online' : '⚫ Offline'} disabled style={{ opacity:.7 }} />
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowContactProfile(false)}>Sluiten</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── OPROEPEN MODAL ── */}
      {showCallModal && (
        <div className="modal-overlay" onClick={() => setShowCallModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">📞 Oproepen</h3>
            <p className="modal-sub">Kies een contact om te bellen</p>
            {contacts.length === 0 && (
              <div className="auth-error">⚠️ Geen contacten. Voeg eerst iemand toe.</div>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'16px' }}>
              {contacts.map(contact => (
                <div key={contact.uid} className="call-contact-row">
                  <div className="avatar-wrap">
                    <UserAvatar photoURL={contact.photoURL} displayName={contact.displayName} className="sm" />
                    {onlineUsers.has(contact.uid) && <span className="online-dot sm" />}
                  </div>
                  <div style={{ flex:1 }}>
                    <div className="conv-name">{contact.displayName}</div>
                    <div className="conv-preview">
                      {onlineUsers.has(contact.uid) ? '🟢 Online' : contact.email}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'8px' }}>
                    <button className="call-btn voice" onClick={() => callContact(contact, false)} title="Bellen">📞</button>
                    <button className="call-btn video" onClick={() => callContact(contact, true)}  title="Videobellen">🎥</button>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-secondary" onClick={() => setShowCallModal(false)}>Sluiten</button>
          </div>
        </div>
      )}

      {/* ── GROEPSINFORMATIE MODAL ── */}
      {showGroupInfo && activeConv?.isGroup && (
        <div className="modal-overlay" onClick={() => { setShowGroupInfo(false); setAddingMember(false); }}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">👥 {getConvName(activeConv)}</h3>
            <p className="modal-sub">{activeConv.members.length} deelnemers</p>

            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'16px' }}>
              {activeConv.members.map(uid => {
                const name     = activeConv.memberNames?.[uid] || uid;
                const isMe     = uid === user.uid;
                const isOnline = onlineUsers.has(uid);
                const photo    = contacts.find(c => c.uid === uid)?.photoURL || null;
                return (
                  <div key={uid} className="search-result" style={{ cursor:'default' }}>
                    <div className="avatar-wrap">
                      <UserAvatar photoURL={photo} displayName={name} className="sm" />
                      {isOnline && <span className="online-dot sm" />}
                    </div>
                    <div style={{ flex:1 }}>
                      <div className="conv-name">{name}{isMe ? ' (jij)' : ''}</div>
                      <div className="conv-preview" style={isOnline ? { color:'var(--success)' } : {}}>
                        {isOnline ? 'Online' : 'Offline'}
                      </div>
                    </div>
                    {!isMe && (
                      <button className="icon-btn" title="Verwijderen uit groep"
                        onClick={() => removeMemberFromGroup(uid)}
                        style={{ color:'var(--danger)', flexShrink:0 }}>🗑️</button>
                    )}
                  </div>
                );
              })}
            </div>

            {!addingMember ? (
              <button className="btn-secondary" onClick={() => setAddingMember(true)}>+ Lid toevoegen</button>
            ) : (
              <>
                <p className="modal-sub">Kies een contact om toe te voegen</p>
                <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'12px' }}>
                  {contacts.filter(c => !activeConv.members.includes(c.uid)).length === 0 && (
                    <div className="auth-error">⚠️ Alle contacten zijn al lid van deze groep.</div>
                  )}
                  {contacts.filter(c => !activeConv.members.includes(c.uid)).map(c => (
                    <div key={c.uid} className="search-result" onClick={() => addMemberToGroup(c)}>
                      <div className="avatar-circle sm">{getInitials(c.displayName)}</div>
                      <div>
                        <div className="conv-name">{c.displayName}</div>
                        <div className="conv-preview">{c.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn-secondary" onClick={() => setAddingMember(false)}>Annuleren</button>
              </>
            )}

            <div className="modal-actions" style={{ marginTop:'16px' }}>
              <button className="btn-secondary" onClick={() => { setShowGroupInfo(false); setAddingMember(false); }}>Sluiten</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIEF GESPREK OVERLAY ── */}
      {activeCall && (
        <CallOverlay
          active={activeCall}
          user={user}
          onEnd={() => setActiveCall(null)}
        />
      )}
    </div>
  );
}
