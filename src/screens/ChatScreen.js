// src/screens/ChatScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { signOut, updateProfile as fbUpdateProfile } from 'firebase/auth';
import { auth, db, storage } from '../firebase';
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getSocket, BACKEND_URL, startCall } from '../services/socket';
import CallOverlay from '../components/CallOverlay';
import { Phone, Video, Camera, Delete, Search, Message, Users, Moon, Lightbulb, Send, Check, CheckDouble, Clock, Cancel, MagicEdit, User, PhoneCall, PhoneOutgoing, Share } from '../components/Icons';

const MSG_LIMIT = 30;

export default function ChatScreen({ user, onlineUsers = new Set(), lightMode, onToggleTheme, missedCallAlert, onCallLogRead }) {
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
  const [contactNickname,  setContactNickname]  = useState('');
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
  const [callLogRead,    setCallLogRead]    = useState(false);

  // Groepsinformatie
  const [showGroupInfo,  setShowGroupInfo]  = useState(false);
  const [addingMember,   setAddingMember]   = useState(false);

  // Contactprofiel
  const [showContactProfile, setShowContactProfile] = useState(false);

  // Bevestigingsdialoog
  const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm }

  // Contact hernoemen
  const [renamingContact, setRenamingContact] = useState(null); // { uid, name }
  const [sharingContact,       setSharingContact]       = useState(null); // contact to share
  const [shareRecipients,      setShareRecipients]      = useState([]);   // selected recipients
  const [viewingSharedContact, setViewingSharedContact] = useState(null); // shared contact profile
  const [friendReqSent,        setFriendReqSent]        = useState(false);
  const [friendReqLoading,     setFriendReqLoading]     = useState(false);
  const [renameValue,     setRenameValue]     = useState('');

  // Contact profiel bekijken (vanuit contactenlijst)
  const [viewingContact,  setViewingContact]  = useState(null);

  function getContactNickname(uid) {
    return localStorage.getItem(`pulse_nick_${uid}`) || null;
  }
  function saveContactNickname(uid, name) {
    if (name.trim()) localStorage.setItem(`pulse_nick_${uid}`, name.trim());
    else localStorage.removeItem(`pulse_nick_${uid}`);
  }
  function getContactDisplayName(contact) {
    return getContactNickname(contact.uid) || contact.displayName;
  }

  // Reply
  const [replyTo, setReplyTo] = useState(null); // { id, text, senderName }

  // Zoeken in gesprek
  const [showChatSearch,  setShowChatSearch]  = useState(false);
  const [chatSearch,      setChatSearch]      = useState('');
  const [chatSearchIdx,   setChatSearchIdx]   = useState(0);
  const chatSearchRef = useRef(null);

  // Bel-dropdown in conv-list
  const [callDropdown, setCallDropdown] = useState(null); // convId

  // Groep aanmaken
  const [showNewGroup,   setShowNewGroup]   = useState(false);
  const [groupName,      setGroupName]      = useState('');
  const [groupMembers,   setGroupMembers]   = useState([]);

  // Profiel
  const [showProfile,    setShowProfile]    = useState(false);
  const [newName,        setNewName]        = useState(user.displayName || '');
  const [photoFile,      setPhotoFile]      = useState(null);
  const [photoPreview,   setPhotoPreview]   = useState(localStorage.getItem(`pulse_photo_${user.uid}`) || user.photoURL || null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg,     setProfileMsg]     = useState('');

  const msgEndRef      = useRef(null);
  const msgsAreaRef    = useRef(null);
  const textareaRef    = useRef(null);
  const typingTimer    = useRef(null);
  const activeConvRef  = useRef(null);
  const photoInputRef  = useRef(null);
  const callStartTimeRef = useRef(null);
  const callIsVideoRef   = useRef(false);
  const callConvIdRef    = useRef(null);
  const socket         = getSocket();

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
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Haal actuele foto op uit het user-document van elk contact
      const enriched = await Promise.all(raw.map(async (c) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', c.uid));
          if (userDoc.exists() && userDoc.data().photoURL) {
            return { ...c, photoURL: userDoc.data().photoURL };
          }
        } catch {}
        return c;
      }));
      setContacts(enriched);
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
          // Vervang pending call bericht met het bevestigde bericht
          if (msg.type === 'call') {
            const callPendingIdx = prev.findIndex(m => m.pending && m.type === 'call' && m.senderId === msg.senderId);
            if (callPendingIdx !== -1) {
              const next = [...prev];
              next[callPendingIdx] = { ...msg, pending: false };
              return next;
            }
            if (prev.some(m => m.id && m.id === msg.id)) return prev;
            return [...prev, msg];
          }
          // Vervang pending (optimistic) bericht als het van onszelf komt
          const pendingIdx = prev.findIndex(m => m.pending && m.senderId === msg.senderId && m.text === msg.text);
          if (pendingIdx !== -1) {
            const next = [...prev];
            next[pendingIdx] = { ...msg, pending: false };
            return next;
          }
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

    const onMessageStatus = ({ convId, msgId, status }) => {
      if (status === 'read') setReadConvs(prev => new Set([...prev, convId]));
      if (status === 'delivered' && msgId) {
        setMessages(prev => prev.map(m => m.id === msgId && m.status !== 'read' ? { ...m, status: 'delivered' } : m));
      }
    };

    const onFriendRequest = (req) => {
      setFriendRequests(prev => [req, ...prev.filter(r => r.id !== req.id)]);
      // Uitnodigingsgeluid: twee oplopende tonen
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [[600, 0], [900, 0.18]].forEach(([freq, delay]) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
          gain.gain.setValueAtTime(0.18, ctx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.25);
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + 0.25);
          osc.onended = () => { try { ctx.close(); } catch {} };
        });
      } catch {}
      if (Notification.permission === 'granted') {
        new Notification('Nieuwe uitnodiging', { body: `${req.fromName} wil je toevoegen`, icon: '/logo192.png' });
      }
    };

    const onFriendAccepted = ({ byName }) => {
      loadContacts();
      setContactSuccess(`${byName} heeft je uitnodiging geaccepteerd!`);
      setTimeout(() => setContactSuccess(''), 4000);
      // Acceptatiegeluid: drie oplopende tonen
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [[500, 0], [700, 0.15], [1000, 0.30]].forEach(([freq, delay]) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
          gain.gain.setValueAtTime(0.18, ctx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.22);
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + 0.22);
          osc.onended = () => { try { ctx.close(); } catch {} };
        });
      } catch {}
    };

    const onUserUpdated = ({ uid, displayName, photoURL }) => {
      setContacts(prev => prev.map(c => c.uid === uid ? { ...c, displayName: displayName || c.displayName, photoURL: photoURL || c.photoURL } : c));
      if (displayName) {
        setConversations(prev => prev.map(conv =>
          conv.memberNames?.[uid] ? { ...conv, memberNames: { ...conv.memberNames, [uid]: displayName } } : conv
        ));
        setActiveConv(prev => prev?.memberNames?.[uid] ? { ...prev, memberNames: { ...prev.memberNames, [uid]: displayName } } : prev);
      }
    };

    socket.on('connect',          onConnect);
    socket.on('disconnect',       onDisconnect);
    socket.on('message:received', onMessageReceived);
    socket.on('typing:update',    onTypingUpdate);
    socket.on('message:status',   onMessageStatus);
    socket.on('friend:request',   onFriendRequest);
    socket.on('friend:accepted',  onFriendAccepted);
    socket.on('user:updated',     onUserUpdated);

    return () => {
      socket.off('connect',          onConnect);
      socket.off('disconnect',       onDisconnect);
      socket.off('message:received', onMessageReceived);
      socket.off('typing:update',    onTypingUpdate);
      socket.off('message:status',   onMessageStatus);
      socket.off('friend:request',   onFriendRequest);
      socket.off('friend:accepted',  onFriendAccepted);
      socket.off('user:updated',     onUserUpdated);
    };
  }, [socket, loadConversations, loadContacts]);

  // Sluit call dropdown bij klik buiten
  useEffect(() => {
    if (!callDropdown) return;
    const close = () => setCallDropdown(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [callDropdown]);

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
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const t = ctx.currentTime;
      // Twee zachte tonen — WhatsApp-achtig
      [[880, 0, 0.08], [1100, 0.09, 0.14]].forEach(([freq, start, end]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + start);
        gain.gain.setValueAtTime(0, t + start);
        gain.gain.linearRampToValueAtTime(0.18, t + start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + end);
        osc.start(t + start);
        osc.stop(t + end);
      });
      setTimeout(() => ctx.close(), 400);
    } catch {}
  }

  // ── Gesprek verwijderen ───────────────────────────────────────────────────
  async function deleteConversation(e, convId) {
    e.stopPropagation();
    setConfirmDialog({
      message: 'Weet je zeker dat je dit gesprek wilt verwijderen?',
      onConfirm: async () => {
        try {
          await fetch(`${BACKEND_URL}/api/conversations/${convId}?uid=${user.uid}`, { method: 'DELETE' });
        } catch (e) { console.error(e); }
        setConversations(prev => prev.filter(c => c.id !== convId));
        if (activeConv?.id === convId) { setActiveConv(null); setMessages([]); }
      },
    });
  }

  // ── Gesprek openen ────────────────────────────────────────────────────────
  async function openConversation(conv) {
    const convId = conv.id;
    setActiveConv(conv);
    activeConvRef.current = conv; // direct updaten zodat socket events meteen de juiste conv kennen
    setActiveTab('chats');
    setShowChatSearch(false);
    setChatSearch('');
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
    const tempId = `temp-${Date.now()}`;
    const msg = {
      convId:     activeConv.id,
      senderId:   user.uid,
      senderName: user.displayName || user.email,
      text:       text.trim(),
      createdAt:  new Date().toISOString(),
      ...(replyTo ? { replyTo } : {}),
    };
    setReplyTo(null);
    // Optimistic UI: toon bericht direct zonder te wachten op server
    setMessages(prev => [...prev, { ...msg, id: tempId, pending: true }]);
    socket.emit('message:send', { convId: activeConv.id, message: msg }, (savedMsg) => {
      // Vervang tijdelijk bericht met bevestigd bericht van server
      if (savedMsg?.id) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...savedMsg, pending: false } : m));
      }
    });
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
      if (contactNickname.trim() && data.toUid) {
        saveContactNickname(data.toUid, contactNickname.trim());
      }
      setContactEmail(''); setContactNickname('');
      setShowAddContact(false);
      if (data.restored) {
        // Ander had ons nog → direct hersteld, geen verzoek nodig
        await loadContacts();
        setContactSuccess('Contact hersteld!');
      } else {
        setContactSuccess('Uitnodiging verzonden!');
      }
      setTimeout(() => setContactSuccess(''), 4000);
    } catch (e) { console.error('addContact fout:', e); setContactErr('Verbindingsfout'); }
    finally { setContactLoading(false); }
  }

  async function sendFriendRequestToEmail(email) {
    setFriendReqLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/friend-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromUid: user.uid, fromName: user.displayName || user.email, fromEmail: user.email, fromPhoto: user.photoURL || null, toEmail: email }),
      });
      if (res.ok) setFriendReqSent(true);
    } catch (e) { console.error('sendFriendRequestToEmail fout:', e); }
    finally { setFriendReqLoading(false); }
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
  function removeContact(uid) {
    setConfirmDialog({
      message: 'Weet je zeker dat je dit contact wilt verwijderen?',
      onConfirm: async () => {
        await deleteDoc(doc(db, 'users', user.uid, 'contacts', uid));
        setContacts(prev => prev.filter(c => c.uid !== uid));
        // Ook het gesprek met dit contact verwijderen
        const conv = conversations.find(c => !c.isGroup && c.members?.includes(uid));
        if (conv) {
          try { await fetch(`${BACKEND_URL}/api/conversations/${conv.id}?uid=${user.uid}`, { method: 'DELETE' }); } catch {}
          setConversations(prev => prev.filter(c => c.id !== conv.id));
          if (activeConv?.id === conv.id) { setActiveConv(null); setMessages([]); }
        }
      },
    });
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
    setConfirmDialog({
      message: 'Weet je zeker dat je deze persoon wilt verwijderen uit de groep?',
      onConfirm: () => {
        socket.emit('conversation:removeMember', { convId: activeConv.id, uid }, (res = {}) => {
          if (res.error) return alert(res.error);
          setActiveConv(prev => {
            const members     = prev.members.filter(m => m !== uid);
            const memberNames = { ...prev.memberNames };
            delete memberNames[uid];
            return { ...prev, members, memberNames };
          });
        });
      },
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

  // ── Profielfoto resizen naar base64 (geen externe opslag nodig) ──────────
  function resizeImageToBase64(file, size = 200) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        // Vierkant bijsnijden
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    e.target.value = '';
  }

  // ── Profiel opslaan ───────────────────────────────────────────────────────
  async function saveProfile(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setProfileLoading(true); setProfileMsg('');
    try {
      let photoURL = localStorage.getItem(`pulse_photo_${user.uid}`) || user.photoURL || null;
      if (photoFile) {
        photoURL = await resizeImageToBase64(photoFile, 200);
        // base64 lokaal opslaan (Firebase Auth staat geen base64 toe)
        localStorage.setItem(`pulse_photo_${user.uid}`, photoURL);
      }
      // Firebase Auth alleen naam updaten (geen base64 URL)
      const authPhotoURL = photoURL?.startsWith('data:') ? (user.photoURL || null) : photoURL;
      await fbUpdateProfile(auth.currentUser, { displayName: newName.trim(), photoURL: authPhotoURL });
      // Sync naar backend zodat anderen de nieuwe foto/naam zien
      fetch(`${BACKEND_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, displayName: newName.trim(), email: user.email, photoURL: photoURL || '' }),
      }).catch(() => {});
      // Broadcast profielupdate zodat contacten live worden bijgewerkt
      socket?.emit('user:updated', { uid: user.uid, displayName: newName.trim(), photoURL: photoURL || '' });
      setPhotoFile(null);
      setPhotoPreview(photoURL);
      setProfileMsg('Opgeslagen!');
    } catch (err) { setProfileMsg('Fout bij opslaan: ' + (err.message || err.code)); }
    finally { setProfileLoading(false); }
  }

  // ── Account verwijderen ───────────────────────────────────────────────────
  function handleDeleteAccount() {
    setConfirmDialog({
      message: 'Weet je zeker dat je je account wilt verwijderen? Al je chats en gegevens worden permanent verwijderd.',
      onConfirm: async () => {
        try {
          await fetch(`${BACKEND_URL}/api/account/${user.uid}`, { method: 'DELETE' });
          localStorage.removeItem(`pulse_photo_${user.uid}`);
          localStorage.removeItem(`pulse_calls_${user.uid}`);
          await signOut(auth);
        } catch (err) {
          alert('Verwijderen mislukt: ' + err.message);
        }
      },
    });
  }

  // ── Oproeplog helpers ─────────────────────────────────────────────────────
  function logCall({ uid, name, photoURL, isVideo, direction }) {
    const key = `pulse_calls_${user.uid}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const entry = { uid, name, photoURL: photoURL || '', isVideo, direction, ts: Date.now() };
    localStorage.setItem(key, JSON.stringify([entry, ...existing].slice(0, 50)));
  }

  function getCallLog() {
    return JSON.parse(localStorage.getItem(`pulse_calls_${user.uid}`) || '[]');
  }

  function findConvWithUid(uid) {
    return conversations.find(conv => !conv.isGroup && conv.members?.includes(uid) && conv.members?.includes(user.uid));
  }

  function sendContactCard(toContact, sharedContact) {
    const conv = findConvWithUid(toContact.uid);
    if (!conv || !socket) return;
    socket.emit('conversation:join', { convId: conv.id });
    const msg = {
      convId:        conv.id,
      senderId:      user.uid,
      senderName:    user.displayName || user.email,
      type:          'contact',
      sharedContact: { uid: sharedContact.uid, name: getContactDisplayName(sharedContact), email: sharedContact.email || '' },
      createdAt:     new Date().toISOString(),
    };
    socket.emit('message:send', { convId: conv.id, message: msg });
    setSharingContact(null);
  }

  function sendCallMessage({ isVideo, direction, duration }) {
    const convId = callConvIdRef.current;
    if (!socket || !convId) return;
    // Zorg dat socket in de kamer zit zodat message:received terugkomt
    socket.emit('conversation:join', { convId });
    // Voeg bericht optimistisch toe zodat de beller het direct ziet
    if (activeConvRef.current?.id === convId) {
      const optimistic = {
        id: `call-pending-${Date.now()}`,
        convId, type: 'call', isVideo, direction, duration: duration || 0,
        senderId: user.uid, senderName: user.displayName || user.email,
        createdAt: new Date().toISOString(), pending: true,
      };
      setMessages(prev => [...prev, optimistic]);
      setTimeout(() => {
        if (msgsAreaRef.current) msgsAreaRef.current.scrollTo({ top: msgsAreaRef.current.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
    socket.emit('call:log', {
      convId, isVideo, direction, duration: duration || 0,
      senderId: user.uid, senderName: user.displayName || user.email,
    });
    loadConversations();
  }

  // ── Bellen vanuit oproepen-modal ─────────────────────────────────────────
  async function callContact(contact, isVideo) {
    setShowCallModal(false);
    const toUid = contact.uid;
    const name  = contact.displayName;
    logCall({ uid: toUid, name, photoURL: contact.photoURL, isVideo, direction: 'outgoing' });
    callConvIdRef.current    = findConvWithUid(toUid)?.id || null;
    callStartTimeRef.current = null;
    callIsVideoRef.current   = isVideo;
    const stream = await startCall({
      toUid, fromUid: user.uid, callerName: user.displayName || user.email, isVideo,
      onStream: (remoteStream, localStream) => {
        callStartTimeRef.current = Date.now();
        setActiveCall(prev => ({ ...prev, remoteStream, localStream }));
      },
      onEnd: (reason) => {
        const wasConnected = callStartTimeRef.current !== null;
        const duration  = wasConnected ? Math.round((Date.now() - callStartTimeRef.current) / 1000) : 0;
        callStartTimeRef.current = null;
        const callDir = reason === 'declined' ? 'declined'
          : (!wasConnected || reason === 'timeout' || reason === 'unavailable') ? 'no-answer'
          : 'completed';
        sendCallMessage({ isVideo: callIsVideoRef.current, direction: callDir, duration });
        if (reason === 'unavailable' || reason === 'declined' || reason === 'timeout') {
          setActiveCall(prev => prev ? { ...prev, endReason: reason } : null);
        } else {
          setActiveCall(null);
        }
      },
      onVideoUpgrade: (localStream) => {
        callIsVideoRef.current = true;
        setActiveCall(prev => ({ ...prev, localStream, isVideo: true }));
      },
      onVideoUpgradeRequest: () => {
        setActiveCall(prev => prev ? { ...prev, videoUpgradeRequest: true } : prev);
      },
    });
    if (stream) setActiveCall({ toUid, isVideo, name, localStream: null, remoteStream: null });
  }

  // ── Bellen ────────────────────────────────────────────────────────────────
  async function initiateCall(isVideo) {
    if (!activeConv || !Array.isArray(activeConv.members)) return;
    const toUid = activeConv.members.find(m => m !== user.uid);
    if (!toUid) return;
    const name  = activeConv.memberNames?.[toUid] || 'Contactpersoon';
    const photo = contacts.find(c => c.uid === toUid)?.photoURL || '';
    logCall({ uid: toUid, name, photoURL: photo, isVideo, direction: 'outgoing' });
    callConvIdRef.current    = activeConv.id;
    callStartTimeRef.current = null;
    callIsVideoRef.current   = isVideo;
    const stream = await startCall({
      toUid, fromUid: user.uid, callerName: user.displayName || user.email, isVideo,
      onStream: (remoteStream, localStream) => {
        callStartTimeRef.current = Date.now();
        setActiveCall(prev => ({ ...prev, remoteStream, localStream }));
      },
      onEnd: (reason) => {
        const wasConnected = callStartTimeRef.current !== null;
        const duration  = wasConnected ? Math.round((Date.now() - callStartTimeRef.current) / 1000) : 0;
        callStartTimeRef.current = null;
        const callDir = reason === 'declined' ? 'declined'
          : (!wasConnected || reason === 'timeout' || reason === 'unavailable') ? 'no-answer'
          : 'completed';
        sendCallMessage({ isVideo: callIsVideoRef.current, direction: callDir, duration });
        if (reason === 'unavailable' || reason === 'declined' || reason === 'timeout') {
          setActiveCall(prev => prev ? { ...prev, endReason: reason } : null);
        } else {
          setActiveCall(null);
        }
      },
      onVideoUpgrade: (localStream) => {
        callIsVideoRef.current = true;
        setActiveCall(prev => ({ ...prev, localStream, isVideo: true }));
      },
      onVideoUpgradeRequest: () => {
        setActiveCall(prev => prev ? { ...prev, videoUpgradeRequest: true } : prev);
      },
    });
    if (stream) setActiveCall({ toUid, isVideo, name, localStream: null, remoteStream: null });
  }

  // ── Bellen vanuit conv-lijst (zonder chat openen) ────────────────────────
  async function initiateCallFromConv(conv, isVideo) {
    if (!Array.isArray(conv.members)) return;
    const toUid = conv.members.find(m => m !== user.uid);
    if (!toUid) return;
    const name  = conv.memberNames?.[toUid] || 'Contactpersoon';
    const photo = contacts.find(c => c.uid === toUid)?.photoURL || '';
    logCall({ uid: toUid, name, photoURL: photo, isVideo, direction: 'outgoing' });
    callConvIdRef.current    = conv.id;
    callStartTimeRef.current = null;
    callIsVideoRef.current   = isVideo;
    const stream = await startCall({
      toUid, fromUid: user.uid, callerName: user.displayName || user.email, isVideo,
      onStream: (remoteStream, localStream) => {
        callStartTimeRef.current = Date.now();
        setActiveCall(prev => ({ ...prev, remoteStream, localStream }));
      },
      onEnd: (reason) => {
        const wasConnected = callStartTimeRef.current !== null;
        const duration  = wasConnected ? Math.round((Date.now() - callStartTimeRef.current) / 1000) : 0;
        callStartTimeRef.current = null;
        const callDir = reason === 'declined' ? 'declined'
          : (!wasConnected || reason === 'timeout' || reason === 'unavailable') ? 'no-answer'
          : 'completed';
        sendCallMessage({ isVideo: callIsVideoRef.current, direction: callDir, duration });
        if (reason === 'unavailable' || reason === 'declined' || reason === 'timeout') {
          setActiveCall(prev => prev ? { ...prev, endReason: reason } : null);
        } else {
          setActiveCall(null);
        }
      },
      onVideoUpgrade: (localStream) => {
        callIsVideoRef.current = true;
        setActiveCall(prev => ({ ...prev, localStream, isVideo: true }));
      },
      onVideoUpgradeRequest: () => {
        setActiveCall(prev => prev ? { ...prev, videoUpgradeRequest: true } : prev);
      },
    });
    if (stream) setActiveCall({ toUid, isVideo, name, localStream: null, remoteStream: null });
  }

  // ── Hulpfuncties ──────────────────────────────────────────────────────────
  function getConvName(conv) {
    if (conv.isGroup) return conv.groupName || 'Groepsgesprek';
    const otherUid = conv.members?.find(m => m !== user.uid);
    return getContactNickname(otherUid) || conv.memberNames?.[otherUid] || 'Contactpersoon';
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

  function highlightText(text, query) {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((p, i) =>
      p.toLowerCase() === query.toLowerCase()
        ? <mark key={i} style={{ background:'#f59e0b', color:'#000', borderRadius:'2px', padding:'0 1px' }}>{p}</mark>
        : p
    );
  }

  function renderMessages() {
    const items = [];
    let lastDate = null;
    const isConvRead = readConvs.has(activeConv?.id);
    const searchMatches = chatSearch.trim()
      ? messages.filter(m => m.text?.toLowerCase().includes(chatSearch.toLowerCase()))
      : [];
    const focusedMsgId = searchMatches[chatSearchIdx % (searchMatches.length || 1)]?.id;

    messages.forEach((msg, i) => {
      const label = formatDateLabel(msg.createdAt);
      if (label !== lastDate) {
        lastDate = label;
        items.push(<div key={`date-${i}`} className="msg-date-sep"><span>{label}</span></div>);
      }
      const isOwn = msg.senderId === user.uid;
      const isFocused = msg.id === focusedMsgId;

      // ── Call berichten ──
      if (msg.type === 'contact') {
        const sc = msg.sharedContact || {};
        const isAlreadyContact = contacts.some(c => c.uid === sc.uid);
        items.push(
          <div key={msg.id || i} className={`msg-group ${isOwn ? 'out' : 'in'}`}>
            <div className="msg-contact-card" style={{ cursor: isOwn ? 'default' : 'pointer' }}
              onClick={!isOwn ? () => { setFriendReqSent(false); setViewingSharedContact({ ...sc, isAlreadyContact }); } : undefined}>
              <div className="avatar-circle sm" style={{ borderRadius:12, flexShrink:0 }}>{getInitials(sc.name || '')}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:'14px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{sc.name || 'Contactpersoon'}</div>
                {sc.email && <div style={{ fontSize:'12px', color: isOwn ? 'rgba(255,255,255,.65)' : 'var(--text3)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{sc.email}</div>}
              </div>
              <div style={{ fontSize:'11px', color: isOwn ? 'rgba(255,255,255,.5)' : 'var(--text3)', flexShrink:0, alignSelf:'flex-end' }}>{formatTime(msg.createdAt)}</div>
            </div>
          </div>
        );
        return;
      }

      if (msg.type === 'call') {
        const isMissed   = !isOwn && (msg.direction === 'no-answer' || msg.direction === 'declined');
        const durSec     = msg.duration || 0;
        const durationStr = durSec > 0 ? (durSec >= 60 ? `${Math.floor(durSec / 60)} min` : `${durSec} sec`) : '';
        const callLabel  = isOwn
          ? (msg.direction === 'completed' ? (msg.isVideo ? 'Video-oproep' : 'Spraakoproep') : msg.direction === 'declined' ? 'Geweigerd' : 'Geen antwoord')
          : (isMissed ? (msg.isVideo ? 'Gemiste video-oproep' : 'Gemiste spraakoproep') : (msg.isVideo ? 'Video-oproep' : 'Spraakoproep'));
        const callSub    = durationStr || (isMissed ? 'Tik om terug te bellen' : '');
        const iconType   = isMissed ? 'missed' : isOwn ? 'outgoing' : 'incoming';
        items.push(
          <div key={msg.id || i} className={`msg-group ${isOwn ? 'out' : 'in'}`}
            ref={isFocused ? el => el?.scrollIntoView({ behavior:'smooth', block:'center' }) : null}>
            <div className={`msg-call-card ${isOwn ? 'out' : 'in'}${isMissed ? ' missed' : ''}`}>
              <div className={`msg-call-icon ${iconType}`}>
                {msg.isVideo ? <Video size={20} /> : <Phone size={20} />}
              </div>
              <div className="msg-call-info">
                <div className="msg-call-label">{callLabel}</div>
                {callSub && <div className="msg-call-sub">{callSub}</div>}
              </div>
              <div className="msg-call-time">{formatTime(msg.createdAt)}</div>
            </div>
          </div>
        );
        return;
      }

      items.push(
        <div key={msg.id || i} className={`msg-group ${isOwn ? 'out' : 'in'}`}
          ref={isFocused ? el => el?.scrollIntoView({ behavior:'smooth', block:'center' }) : null}>
          {!isOwn && activeConv.isGroup && <div className="msg-sender">{msg.senderName}</div>}
          <div className="msg-bubble-wrap">
            {msg.replyTo && (
              <div className="msg-reply-quote">
                <span className="msg-reply-name">{msg.replyTo.senderName}</span>
                <span className="msg-reply-text">{msg.replyTo.text}</span>
              </div>
            )}
            <div className="msg-bubble" style={isFocused ? { outline:'2px solid #f59e0b', outlineOffset:'2px' } : {}}>
              {chatSearch.trim() ? highlightText(msg.text || '', chatSearch) : msg.text}
            </div>
            <button className="msg-reply-btn" onClick={() => { setReplyTo({ id: msg.id, text: msg.text, senderName: msg.senderName }); textareaRef.current?.focus(); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
            </button>
          </div>
          <div className="msg-time">
            {formatTime(msg.createdAt)}
            {isOwn && (() => {
              const isRead      = readConvs.has(activeConv?.id);
              const isDelivered = isRead || msg.status === 'delivered';
              const isPending   = msg.pending;
              return (
                <span className={`msg-ticks ${isRead ? 'read' : ''}`}>
                  {isPending ? <Clock size={12} /> : isRead ? <CheckDouble size={12} /> : isDelivered ? <CheckDouble size={12} /> : <Check size={12} />}
                </span>
              );
            })()}
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
              <button className="icon-btn" onClick={() => setShowNewChat(true)} title="Nieuw gesprek"><Message size={18} /></button>
              <button className="icon-btn" onClick={() => { setShowCallModal(true); setCallLogRead(true); onCallLogRead?.(); }} title="Oproepen" style={{ position:'relative' }}>
                <Phone size={18} />
                {(!callLogRead && getCallLog().some(e => e.direction === 'missed')) || missedCallAlert ? (
                  <span style={{ position:'absolute', top:'4px', right:'4px', width:'8px', height:'8px', borderRadius:'50%', background:'var(--danger)', border:'2px solid var(--surface)' }} />
                ) : null}
              </button>
              <button className="icon-btn" onClick={() => setShowNewGroup(true)} title="Nieuwe groep"><Users size={18} /></button>
            </div>
          </div>
          <div className="search-box">
            <Search size={16} style={{ color:'var(--text3)', flexShrink:0 }} />
            <input
              placeholder="Zoeken…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="sidebar-tabs">
          <button className={`sidebar-tab ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => { setActiveTab('chats'); setSearchQuery(''); }}><Message size={15} /> Chats</button>
          <button className={`sidebar-tab ${activeTab === 'contacts' ? 'active' : ''}`} onClick={() => { setActiveTab('contacts'); setSearchQuery(''); }}>
            <Users size={15} /> Contacten{friendRequests.length > 0 && <span className="unread-badge" style={{ marginLeft: '6px', fontSize: '11px', padding: '1px 6px' }}>{friendRequests.length}</span>}
          </button>
        </div>

        {/* ── CHATS TAB ── */}
        {activeTab === 'chats' && (
          <div className="conv-list">
            {conversations.length === 0 && (
              <div className="empty-convs">
                <p>Nog geen gesprekken.</p>
                <p>Klik op het chat-icoon om een nieuwe chat te starten.</p>
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
                  {!conv.isGroup && (
                    <>
                      <button className="call-btn voice" onClick={e => { e.stopPropagation(); initiateCallFromConv(conv, false); }} title="Bellen"><Phone size={16} /></button>
                      <button className="call-btn video" onClick={e => { e.stopPropagation(); initiateCallFromConv(conv, true); }} title="Videobellen"><Video size={16} /></button>
                    </>
                  )}
                  <button className="conv-delete-btn" onClick={e => deleteConversation(e, conv.id)} title="Verwijderen"><Delete size={16} /></button>
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
              <div key={contact.uid} style={{ margin: '0 12px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="avatar-wrap">
                    <UserAvatar photoURL={contact.photoURL} displayName={contact.displayName} />
                    {onlineUsers.has(contact.uid) && <span className="online-dot" />}
                  </div>
                  <div className="conv-info">
                    <div className="conv-name">{getContactDisplayName(contact)}</div>
                    <div className="conv-preview">{contact.email}</div>
                  </div>
                </div>
                <div style={{ height: '1px', background: 'var(--border)' }} />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="icon-btn" onClick={() => { setViewingContact(contact); setRenameValue(getContactNickname(contact.uid) || contact.displayName); }} title="Profiel bekijken" style={{ flex:1, justifyContent:'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M12 14c-6 0-8 2.5-8 4v1h16v-1c0-1.5-2-4-8-4z"/></svg>
                  </button>
                  <button className="icon-btn" onClick={() => setSharingContact(contact)} title="Contactpersoon delen" style={{ flex:1, justifyContent:'center' }}><Share size={18} /></button>
                  <button className="icon-btn" onClick={() => startChatWithContact(contact)} title="Stuur bericht" style={{ flex:1, justifyContent:'center' }}><Message size={16} /></button>
                  <button className="call-btn voice" onClick={() => callContact(contact, false)} title="Bellen" style={{ flex:1 }}><Phone size={16} /></button>
                  <button className="call-btn video" onClick={() => callContact(contact, true)} title="Videobellen" style={{ flex:1 }}><Video size={16} /></button>
                  <button className="icon-btn" onClick={() => removeContact(contact.uid)} title="Verwijderen" style={{ flex:1, justifyContent:'center', color: 'var(--danger)' }}><Delete size={18} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="sidebar-footer">
          <div className="user-chip" style={{ cursor:'pointer' }} onClick={() => { setShowProfile(true); setProfileMsg(''); setNewName(user.displayName || ''); setPhotoPreview(localStorage.getItem(`pulse_photo_${user.uid}`) || user.photoURL || null); setPhotoFile(null); }}>
            <div className="avatar-wrap" style={{ flexShrink:0 }}>
              <UserAvatar photoURL={localStorage.getItem(`pulse_photo_${user.uid}`) || user.photoURL} displayName={user.displayName || user.email} className="sm" />
            </div>
            <div className="user-chip-info">
              <div className="user-chip-name">{user.displayName || user.email.split('@')[0]}</div>
              <div className="user-chip-status">Online</div>
            </div>
          </div>
          <button className="icon-btn" onClick={onToggleTheme} title={lightMode ? 'Donker thema' : 'Licht thema'}>{lightMode ? <Moon size={18} /> : <Lightbulb size={18} />}</button>
          <button className="icon-btn danger" onClick={() => signOut(auth)} title="Uitloggen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{transform:'scaleX(-1)'}}><path d="M16 13v-2H7V8l-5 4 5 4v-3z"/><path d="M20 3H10a2 2 0 0 0-2 2v4h2V5h10v14H10v-4H8v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/></svg>
          </button>
        </div>
      </aside>

      {/* ── CHAT MAIN ── */}
      <main className="chat-main">
        {!activeConv ? (
          <div className="empty-state">
            <div className="empty-icon"><Message size={48} /></div>
            <div className="empty-title">Kies een gesprek</div>
            <p>Of klik op het chat-icoon om een nieuwe chat te beginnen.</p>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <button className="back-btn" onClick={() => setActiveConv(null)} title="Terug">←</button>
              <div className="avatar-wrap" style={{ cursor: !activeConv.isGroup ? 'pointer' : 'default' }} onClick={() => { if (!activeConv.isGroup) { const otherUid = getOtherUid(activeConv); setRenameValue(getContactNickname(otherUid) || getConvName(activeConv)); setShowContactProfile(true); } }}>
                <UserAvatar photoURL={getConvPhoto(activeConv)} displayName={getConvName(activeConv)} className="sm" />
                {getOtherUid(activeConv) && onlineUsers.has(getOtherUid(activeConv)) && <span className="online-dot sm" />}
              </div>
              <div className="chat-header-info" style={{ cursor: !activeConv.isGroup ? 'pointer' : 'default' }} onClick={() => { if (!activeConv.isGroup) { const otherUid = getOtherUid(activeConv); setRenameValue(getContactNickname(otherUid) || getConvName(activeConv)); setShowContactProfile(true); } }}>
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
                    <button className="call-btn voice" onClick={() => initiateCall(false)} title="Bellen"><Phone size={18} /></button>
                    <button className="call-btn video" onClick={() => initiateCall(true)} title="Videobellen"><Video size={18} /></button>
                    {(() => { const otherContact = contacts.find(c => c.uid === getOtherUid(activeConv)); return otherContact ? <button className="icon-btn" onClick={() => setSharingContact(otherContact)} title="Contactpersoon delen"><Share size={18} /></button> : null; })()}
                  </>
                )}
                {activeConv.isGroup && (
                  <button className="icon-btn" onClick={() => setShowGroupInfo(true)} title="Groepsinformatie"><Users size={18} /></button>
                )}
                <button className="icon-btn" onClick={() => { setShowChatSearch(s => !s); setChatSearch(''); setChatSearchIdx(0); setTimeout(() => chatSearchRef.current?.focus(), 50); }} title="Zoeken">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                </button>
              </div>
            </div>

            {/* ── ZOEKBALK IN GESPREK ── */}
            {(() => {
              const matches = messages.filter(m => m.text?.toLowerCase().includes(chatSearch.toLowerCase()) && chatSearch.trim());
              const total   = matches.length;
              const current = total > 0 ? chatSearchIdx % total : 0;
              return (
                <div className={`chat-search-bar${showChatSearch ? ' visible' : ''}`}>
                  <input
                    ref={chatSearchRef}
                    value={chatSearch}
                    onChange={e => { setChatSearch(e.target.value); setChatSearchIdx(0); }}
                    placeholder="Zoeken in gesprek…"
                    style={{ flex:1, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'8px', padding:'7px 12px', color:'var(--text)', fontSize:'14px', outline:'none' }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') setChatSearchIdx(i => (i + 1) % (total || 1));
                      if (e.key === 'Escape') { setShowChatSearch(false); setChatSearch(''); }
                    }}
                  />
                  {chatSearch.trim() && (
                    <span style={{ fontSize:'13px', color:'var(--text3)', whiteSpace:'nowrap' }}>
                      {total === 0 ? 'Geen resultaten' : `${current + 1} / ${total}`}
                    </span>
                  )}
                  {total > 1 && (
                    <>
                      <button className="icon-btn" style={{ width:'30px', height:'30px', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setChatSearchIdx(i => (i - 1 + total) % total)}>↑</button>
                      <button className="icon-btn" style={{ width:'30px', height:'30px', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setChatSearchIdx(i => (i + 1) % total)}>↓</button>
                    </>
                  )}
                  <button className="icon-btn" style={{ width:'30px', height:'30px', display:'flex', alignItems:'center', justifyContent:'center', paddingTop:'5px' }} onClick={() => { setShowChatSearch(false); setChatSearch(''); }}>✕</button>
                </div>
              );
            })()}

            <div className="messages-area" ref={msgsAreaRef} onClick={() => { if (showChatSearch) { setShowChatSearch(false); setChatSearch(''); } }}>
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
              {replyTo && (
                <div className="reply-preview">
                  <div className="reply-preview-inner">
                    <span className="reply-preview-name">{replyTo.senderName}</span>
                    <span className="reply-preview-text">{replyTo.text}</span>
                  </div>
                  <button className="reply-preview-close" onClick={() => setReplyTo(null)}>✕</button>
                </div>
              )}
              <div className="input-row">
                <textarea
                  ref={textareaRef}
                  className="chat-textarea" rows={1}
                  placeholder="Stuur een bericht…"
                  value={text}
                  onChange={e => handleTyping(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button className="send-btn" onClick={sendMessage}><Send size={18} /></button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── CONTACT HERNOEMEN ── */}
      {renamingContact && (
        <div className="modal-overlay" onClick={() => setRenamingContact(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:360 }}>
            <h3 className="modal-title"><MagicEdit size={18} /> Naam wijzigen</h3>
            <div className="form-group">
              <label className="form-label">Bijnaam</label>
              <input
                className="form-input"
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                placeholder={renamingContact.displayName}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') { saveContactNickname(renamingContact.uid, renameValue); setRenamingContact(null); setContacts(prev => [...prev]); } }}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setRenamingContact(null)}>Annuleren</button>
              <button className="btn-primary" onClick={() => { saveContactNickname(renamingContact.uid, renameValue); setRenamingContact(null); setContacts(prev => [...prev]); }}>Opslaan</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTACTPERSOON DELEN ── */}
      {sharingContact && (
        <div className="modal-overlay" onClick={() => { setSharingContact(null); setShareRecipients([]); }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:360 }}>
            <h3 className="modal-title" style={{ whiteSpace:'nowrap', fontSize:'16px', display:'flex', alignItems:'center', gap:'8px' }}><Share size={18} /> Contactpersoon delen</h3>
            <div style={{ marginBottom:'12px', padding:'10px 14px', borderRadius:'10px', background:'var(--surface2)', border:'1px solid var(--border)', display:'flex', alignItems:'center', gap:'10px' }}>
              <div className="avatar sm">{getInitials(getContactDisplayName(sharingContact))}</div>
              <div>
                <div style={{ fontWeight:600, fontSize:'14px' }}>{getContactDisplayName(sharingContact)}</div>
                <div style={{ fontSize:'12px', color:'var(--text3)' }}>{sharingContact.email}</div>
              </div>
            </div>
            <div style={{ fontSize:'13px', color:'var(--text3)', marginBottom:'10px' }}>Stuur naar:</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'260px', overflowY:'auto' }}>
              {contacts.filter(c => c.uid !== sharingContact.uid).map(c => {
                const selected = shareRecipients.includes(c.uid);
                return (
                  <button key={c.uid} className="contact-row" style={{ background: selected ? 'var(--accent-soft, rgba(108,99,255,.15))' : 'none', border: selected ? '1px solid var(--accent)' : '1px solid var(--border)', borderRadius:'10px', padding:'10px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:'10px', color:'var(--text)', textAlign:'left' }}
                    onClick={() => setShareRecipients(prev => prev.includes(c.uid) ? prev.filter(id => id !== c.uid) : [...prev, c.uid])}>
                    <div className="avatar sm">{getInitials(getContactDisplayName(c))}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:500, fontSize:'14px' }}>{getContactDisplayName(c)}</div>
                      <div style={{ fontSize:'12px', color:'var(--text3)' }}>{c.email}</div>
                    </div>
                    {selected && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </button>
                );
              })}
            </div>
            <div className="modal-actions" style={{ marginTop:'14px' }}>
              <button className="btn-secondary" onClick={() => { setSharingContact(null); setShareRecipients([]); }}>Annuleren</button>
              <button className="btn-primary" disabled={shareRecipients.length === 0}
                onClick={() => { shareRecipients.forEach(uid => { const c = contacts.find(x => x.uid === uid); if (c) sendContactCard(c, sharingContact); }); setSharingContact(null); setShareRecipients([]); }}>
                Versturen{shareRecipients.length > 1 ? ` (${shareRecipients.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── GEDEELD CONTACT PROFIEL ── */}
      {viewingSharedContact && (
        <div className="modal-overlay" onClick={() => setViewingSharedContact(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:340, width:'100%' }}>
            <h3 className="modal-title" style={{ display:'flex', alignItems:'center', gap:'10px', fontSize:'18px' }}><User size={20} style={{ flexShrink:0 }} /> Contactpersoon</h3>
            <div style={{ display:'flex', alignItems:'center', gap:'14px', padding:'16px 0 20px' }}>
              <div className="avatar-wrap" style={{ flexShrink:0 }}>
                <div className="avatar-circle" style={{ width:52, height:52, fontSize:20, borderRadius:14 }}>{getInitials(viewingSharedContact.name || '')}</div>
                {viewingSharedContact.uid && onlineUsers.has(viewingSharedContact.uid) && <span className="online-dot" />}
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:'16px' }}>{viewingSharedContact.name || 'Onbekend'}</div>
                {viewingSharedContact.email && <div style={{ fontSize:'13px', color:'var(--text3)', marginTop:2 }}>{viewingSharedContact.email}</div>}
                <div style={{ fontSize:'12px', marginTop:4, display:'flex', alignItems:'center', gap:5 }}>
                  {viewingSharedContact.uid && onlineUsers.has(viewingSharedContact.uid)
                    ? <><span style={{ width:7, height:7, borderRadius:'50%', background:'var(--success)', display:'inline-block' }} /> <span style={{ color:'var(--success)' }}>Online</span></>
                    : <><span style={{ width:7, height:7, borderRadius:'50%', background:'var(--text3)', display:'inline-block' }} /> <span style={{ color:'var(--text3)' }}>Offline</span></>
                  }
                </div>
              </div>
            </div>
            <div className="modal-actions" style={{ justifyContent:'space-between' }}>
              <button className="btn-secondary" onClick={() => setViewingSharedContact(null)}>Sluiten</button>
              {viewingSharedContact.isAlreadyContact
                ? <span style={{ fontSize:'13px', color:'var(--success)', display:'flex', alignItems:'center', gap:'5px' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Al in contacten</span>
                : <button className="btn-primary" disabled={friendReqLoading || friendReqSent}
                    onClick={() => sendFriendRequestToEmail(viewingSharedContact.email)}>
                    {friendReqSent ? '✓ Verzoek verzonden' : friendReqLoading ? 'Verzenden…' : 'Vriendschapsverzoek'}
                  </button>
              }
            </div>
          </div>
        </div>
      )}

      {/* ── CONTACT PROFIEL ── */}
      {viewingContact && (
        <div className="modal-overlay" onClick={() => setViewingContact(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:360 }}>
            <h3 className="modal-title"><User size={18} /> Profiel</h3>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:'20px' }}>
              {viewingContact.photoURL
                ? <img src={viewingContact.photoURL} alt="" className="profile-avatar-big" style={{ objectFit:'cover' }} />
                : <div className="profile-avatar-big">{getInitials(getContactDisplayName(viewingContact))}</div>
              }
            </div>
            <div className="form-group">
              <label className="form-label">Naam</label>
              <div style={{ position:'relative' }}>
                <input className="form-input" value={renameValue} onChange={e => setRenameValue(e.target.value)} placeholder={viewingContact.displayName} style={{ paddingRight:'36px' }} />
                <span style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none' }}><MagicEdit size={22} /></span>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">E-mailadres</label>
              <input className="form-input" value={viewingContact.email || ''} disabled style={{ opacity:.7 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <div className={`profile-status-badge ${onlineUsers.has(viewingContact.uid) ? 'online' : 'offline'}`}>
                <span className="profile-status-dot" />
                {onlineUsers.has(viewingContact.uid) ? 'Online' : 'Offline'}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setViewingContact(null)}>Sluiten</button>
              <button className="btn-primary" style={{ flex:1 }} onClick={() => { saveContactNickname(viewingContact.uid, renameValue); setContacts(prev => [...prev]); setViewingContact(null); }}>Opslaan</button>
            </div>
          </div>
        </div>
      )}

      {/* ── BEVESTIGINGSDIALOOG ── */}
      {confirmDialog && (
        <div className="modal-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '360px' }}>
            <p style={{ color: 'var(--text)', fontSize: '15px', marginBottom: '24px', lineHeight: '1.5' }}>{confirmDialog.message}</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setConfirmDialog(null)}>Annuleren</button>
              <button className="btn-primary" style={{ flex: 1, background: 'linear-gradient(135deg, #ef4444, #dc2626)' }} onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}>Verwijderen</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTACT TOEVOEGEN MODAL ── */}
      {showAddContact && (
        <div className="modal-overlay" onClick={() => setShowAddContact(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title"><Users size={18} /> Vriend uitnodigen</h3>
            <p className="modal-sub">Voer het e-mailadres in van de persoon die je wilt uitnodigen</p>
            <div className="form-group">
              <label className="form-label">E-mailadres</label>
              <input className="form-input" type="email" placeholder="naam@voorbeeld.nl" value={contactEmail} onChange={e => setContactEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && addContact()} />
            </div>
            <div className="form-group">
              <label className="form-label">Bijnaam (optioneel)</label>
              <input className="form-input" placeholder="Bijv. Papa, Mama, Werk…" value={contactNickname} onChange={e => setContactNickname(e.target.value)} onKeyDown={e => e.key === 'Enter' && addContact()} />
            </div>
            {contactErr && <div className="auth-error">⚠️ {contactErr}</div>}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { setShowAddContact(false); setContactEmail(''); setContactNickname(''); setContactErr(''); }}>Annuleren</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={addContact} disabled={contactLoading}>{contactLoading ? 'Verzenden…' : 'Verzoek sturen →'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── NIEUW GESPREK MODAL ── */}
      {showNewChat && (
        <div className="modal-overlay" onClick={() => setShowNewChat(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title"><MagicEdit size={18} /> Nieuwe chat</h3>
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
            <h3 className="modal-title"><Users size={18} /> Nieuwe groep</h3>
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
                <div className="profile-photo-overlay"><Camera size={16} /></div>
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
            <div style={{ marginTop:'16px', borderTop:'1px solid var(--border)', paddingTop:'16px' }}>
              <button
                className="btn-danger"
                style={{ width:'100%' }}
                onClick={() => { setShowProfile(false); handleDeleteAccount(); }}
              >
                <Delete size={16} style={{ marginRight:6 }} /> Account verwijderen
              </button>
            </div>
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
              <h3 className="modal-title"><User size={18} /> Profiel</h3>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:'20px' }}>
                {photo
                  ? <img src={photo} alt="" className="profile-avatar-big" style={{ objectFit:'cover' }} />
                  : <div className="profile-avatar-big">{getInitials(name)}</div>
                }
              </div>
              <div className="form-group">
                <label className="form-label">Naam</label>
                <div style={{ position:'relative' }}>
                  <input className="form-input" value={renameValue} onChange={e => setRenameValue(e.target.value)} placeholder={name} style={{ paddingRight:'36px' }} />
                  <span style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none' }}><MagicEdit size={22} /></span>
                </div>
              </div>
              {email && (
                <div className="form-group">
                  <label className="form-label">E-mailadres</label>
                  <input className="form-input" value={email} disabled style={{ opacity:.7 }} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Status</label>
                <div className={`profile-status-badge ${isOnline ? 'online' : 'offline'}`}>
                  <span className="profile-status-dot" />
                  {isOnline ? 'Online' : 'Offline'}
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowContactProfile(false)}>Sluiten</button>
                <button className="btn-primary" style={{ flex:1 }} onClick={() => { saveContactNickname(uid, renameValue); setContacts(prev => [...prev]); setShowContactProfile(false); }}>Opslaan</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── OPROEPEN MODAL ── */}
      {showCallModal && (() => {
        const callLog = getCallLog();
        return (
          <div className="modal-overlay" onClick={() => setShowCallModal(false)}>
            <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:420 }}>
              <h3 className="modal-title"><Phone size={18} /> Recent</h3>
              {callLog.length === 0 ? (
                <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text3)' }}>
                  <div style={{ fontSize:40, marginBottom:8 }}><Cancel size={40} /></div>
                  <div>Nog geen oproepen</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'16px', maxHeight:360, overflowY:'auto' }}>
                  {callLog.map((entry, i) => {
                    const contact = contacts.find(c => c.uid === entry.uid);
                    const dirIcon = entry.direction === 'outgoing' ? <PhoneOutgoing size={13} /> : entry.direction === 'missed' ? <Cancel size={13} /> : <PhoneCall size={13} />;
                    const dirColor = entry.direction === 'missed' ? 'var(--danger)' : entry.direction === 'outgoing' ? 'var(--accent)' : 'var(--success)';
                    const ago = (() => {
                      const diff = (Date.now() - entry.ts) / 1000;
                      if (diff < 60) return 'Zojuist';
                      if (diff < 3600) return `${Math.floor(diff/60)} min geleden`;
                      if (diff < 86400) return `${Math.floor(diff/3600)} uur geleden`;
                      return new Date(entry.ts).toLocaleDateString('nl-NL');
                    })();
                    return (
                      <div key={i} className="call-log-row">
                        <div className="avatar-wrap">
                          <UserAvatar photoURL={entry.photoURL} displayName={entry.name} className="sm" />
                          {contact && onlineUsers.has(entry.uid) && <span className="online-dot sm" />}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ color:dirColor, fontWeight:700, fontSize:13 }}>{dirIcon}</span>
                            <span className="conv-name">{entry.name}</span>
                            <span style={{ fontSize:11, color:'var(--text3)', marginLeft:'auto' }}>{ago}</span>
                          </div>
                          <div className="conv-preview" style={{ display:'flex', alignItems:'center', gap:4 }}>{entry.isVideo ? <><Video size={12} /> Videogesprek</> : <><Phone size={12} /> Gesprek</>}</div>
                        </div>
                        {contact && (
                          <div style={{ display:'flex', gap:6 }}>
                            <button className="call-btn voice" onClick={() => callContact(contact, false)} title="Bellen"><Phone size={16} /></button>
                            <button className="call-btn video" onClick={() => callContact(contact, true)} title="Videobellen"><Video size={16} /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn-secondary" style={{ flex:1 }} onClick={() => setShowCallModal(false)}>Sluiten</button>
                {callLog.length > 0 && <button className="btn-secondary" style={{ flex:1, color:'var(--danger)' }} onClick={() => { localStorage.removeItem(`pulse_calls_${user.uid}`); setShowCallModal(false); }}>Wissen</button>}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── GROEPSINFORMATIE MODAL ── */}
      {showGroupInfo && activeConv?.isGroup && (
        <div className="modal-overlay" onClick={() => { setShowGroupInfo(false); setAddingMember(false); }}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title"><Users size={18} /> {getConvName(activeConv)}</h3>
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
                        style={{ color:'var(--danger)', flexShrink:0 }}><Delete size={18} /></button>
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
          onClose={() => setActiveCall(null)}
          onEnd={() => setActiveCall(null)}
        />
      )}
    </div>
  );
}
