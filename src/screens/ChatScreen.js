// src/screens/ChatScreen.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { signOut, updateProfile as fbUpdateProfile, updatePassword } from 'firebase/auth';
import { auth, db, storage } from '../firebase';
import { doc, setDoc, getDoc, updateDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getSocket, BACKEND_URL, startCall } from '../services/socket';
import CallOverlay from '../components/CallOverlay';
import { Phone, Video, Camera, Delete, Search, Message, Users, Moon, Lightbulb, Send, Check, CheckDouble, Clock, Cancel, MagicEdit, PhoneCall, PhoneOutgoing, Share, User, Palette, ImageIcon, ColorCircle, LayoutTemplate, EyeOn, EyeOff, Bell, BellOff, Forward, AdminIcon, Label, Heart, Shield, Logout } from '../components/Icons';
import AvatarBuilder from '../components/AvatarBuilder';
import { getInitials, toMs, formatTime, formatDateLabel } from '../utils';
import UserAvatar from '../components/UserAvatar';

const MSG_LIMIT = 30;

function callPreview(conv, currentUid) {
  const { lastCallSenderId, lastCallDirection, lastCallIsVideo } = conv;
  if (!lastCallDirection) return conv.lastMessage || '';
  const isOwn = lastCallSenderId === currentUid;
  const iv = lastCallIsVideo;
  if (lastCallDirection === 'completed') return iv ? 'Video-oproep' : 'Spraakoproep';
  if (lastCallDirection === 'declined')  return isOwn ? 'Geweigerd' : (iv ? 'Gemiste video-oproep' : 'Gemiste spraakoproep');
  return isOwn ? 'Spraakoproep' : (iv ? 'Gemiste video-oproep' : 'Gemiste spraakoproep');
}


export default function ChatScreen({ user, onlineUsers = new Set(), inactiveUsers = new Set(), lightMode, onToggleTheme, missedCallAlert, onCallLogRead, isParent, parentActivityBadge = 0, parentToast = null, onOpenDashboard, initialConvId = null, onConvIdHandled }) {
  async function authFetch(url, options = {}) {
    const token = await user.getIdToken();
    return fetch(url, { ...options, headers: { ...(options.headers || {}), 'Authorization': `Bearer ${token}` } });
  }
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

  // Schermen: 'chats' | 'contacts'
  const [activeTab,      setActiveTab]      = useState('chats');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [chatFilter,     setChatFilter]     = useState('all'); // 'all' | 'familie' | 'vrienden'
  const [convLabels,     setConvLabels]     = useState(() => {
    try { return JSON.parse(localStorage.getItem(`pulse_labels_${user.uid}`) || '{}'); } catch { return {}; }
  });
  const [labelMenuConvId, setLabelMenuConvId] = useState(null);

  const setConvLabel = (convId, label) => {
    const next = label ? { ...convLabels, [convId]: label } : Object.fromEntries(Object.entries(convLabels).filter(([k]) => k !== convId));
    setConvLabels(next);
    localStorage.setItem(`pulse_labels_${user.uid}`, JSON.stringify(next));
    setLabelMenuConvId(null);
  };

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

  // Bericht verwijderen dropdown
  const [deleteMenuMsgId, setDeleteMenuMsgId] = useState(null); // msgId
  const [editingMsg,          setEditingMsg]          = useState(null); // { id, text }
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState(null);
  const [forwardMsg,          setForwardMsg]          = useState(null); // { text }

  // Niet-gestoord modus
  const [dnd, setDnd] = useState(() => localStorage.getItem('pulse_dnd') === '1');
  const dndRef = useRef(dnd);
  function toggleDnd() {
    const next = !dndRef.current;
    dndRef.current = next;
    setDnd(next);
    localStorage.setItem('pulse_dnd', next ? '1' : '0');
    showErrToast(next ? '🔕 Niet gestoord ingeschakeld' : '🔔 Meldingen ingeschakeld');
  }
  const [pausedFeatures, setPausedFeatures] = useState({ chat: false, call: false, video: false });

  // Groep aanmaken
  const [showNewGroup,   setShowNewGroup]   = useState(false);
  const [groupName,      setGroupName]      = useState('');
  const [groupMembers,   setGroupMembers]   = useState([]);

  // Profiel
  const [showProfile,    setShowProfile]    = useState(false);
  const [profileTab,     setProfileTab]     = useState('account'); // 'account' | 'styling'
  const [newName,        setNewName]        = useState(user.displayName || '');
  const [photoFile,      setPhotoFile]      = useState(null);
  const [photoPreview,   setPhotoPreview]   = useState(localStorage.getItem(`pulse_photo_${user.uid}`) || user.photoURL || null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg,     setProfileMsg]     = useState('');

  // Gebruikersnaam
  const [newUsername,      setNewUsername]      = useState('');
  const [usernameLoading,  setUsernameLoading]  = useState(false);
  const [usernameMsg,      setUsernameMsg]      = useState('');

  // Wachtwoord
  const [newPassword,      setNewPassword]      = useState('');
  const [confirmPassword,  setConfirmPassword]  = useState('');
  const [showNewPassword,  setShowNewPassword]  = useState(false);
  const [passwordLoading,  setPasswordLoading]  = useState(false);
  const [passwordMsg,      setPasswordMsg]      = useState('');

  // Chat achtergrond
  const [chatBg,        setChatBg]        = useState(null); // { type: 'photo', url } | { type: 'color', value } | null
  const [chatBgLoading, setChatBgLoading] = useState(false);
  const [chatBgTab,     setChatBgTab]     = useState('foto'); // 'foto' | 'kleur' | 'standaard'
  const [chatBgMsg,     setChatBgMsg]     = useState('');

  // Avatar builder
  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false);
  const [avatarOptions,     setAvatarOptions]     = useState(null);

  // @mentions
  const [mentionSuggestions,  setMentionSuggestions]  = useState([]); // [{ uid, displayName, photoURL }]
  const [mentionSelIdx,       setMentionSelIdx]       = useState(0);
  const [pendingMentions,     setPendingMentions]     = useState([]); // [{ uid, displayName }]
  const [mentionToast,        setMentionToast]        = useState(null); // { senderName, groupName }
  const [errToast,            setErrToast]            = useState('');
  const errToastTimer = useRef(null);
  function showErrToast(msg) {
    setErrToast(msg);
    clearTimeout(errToastTimer.current);
    errToastTimer.current = setTimeout(() => setErrToast(''), 4000);
  }

  const msgEndRef        = useRef(null);
  const msgsAreaRef      = useRef(null);
  const textareaRef      = useRef(null);
  const typingTimer      = useRef(null);
  const activeConvRef    = useRef(null);
  const conversationsRef = useRef([]);
  const photoInputRef       = useRef(null);
  const bgInputRef          = useRef(null);
  const callStartTimeRef    = useRef(null);
  const disconnectTimerRef  = useRef(null);
  const callIsVideoRef   = useRef(false);
  const callConvIdRef    = useRef(null);
  const socket           = getSocket();

  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  // ── Gesprekken laden ──────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const res  = await authFetch(`${BACKEND_URL}/api/conversations/${user.uid}`);
      const data = await res.json();
      setConversations(Array.isArray(data) ? data : []);
      // Auto-join alle kamer-rooms zodat berichten altijd real-time aankomen
      // + online status opnieuw opvragen zodat groene stippen kloppen
      const sock = getSocket();
      if (sock && Array.isArray(data)) {
        data.forEach(conv => sock.emit('conversation:join', { convId: conv.id }));
        sock.emit('users:online:request');
      }
    } catch (e) { console.error(e); }
  }, [user.uid]);

  // ── Contacten laden uit Firestore ─────────────────────────────────────────
  const loadContacts = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'contacts'));
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Haal alleen foto op voor contacten die er nog geen hebben
      const needsPhoto = raw.filter(c => !c.photoURL);
      const photoMap = {};
      if (needsPhoto.length > 0) {
        const docs = await Promise.all(needsPhoto.map(c => getDoc(doc(db, 'users', c.uid))));
        docs.forEach((d, i) => {
          if (d.exists() && d.data().photoURL) photoMap[needsPhoto[i].uid] = d.data().photoURL;
        });
      }
      const enriched = raw.map(c => ({ ...c, photoURL: c.photoURL || photoMap[c.uid] || null }));
      setContacts(enriched);
    } catch (e) { console.error(e); }
  }, [user.uid]);

  // ── Vriendschapsverzoeken laden ───────────────────────────────────────────
  const loadFriendRequests = useCallback(async () => {
    try {
      const res  = await authFetch(`${BACKEND_URL}/api/friend-requests/${user.uid}`);
      const data = await res.json();
      setFriendRequests(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  }, [user.uid]);

  useEffect(() => { loadConversations(); loadContacts(); loadFriendRequests(); }, [loadConversations, loadContacts, loadFriendRequests]);

  // Deep-link via notificatie-tik: open het juiste gesprek zodra conversations geladen zijn
  useEffect(() => {
    if (!initialConvId || !conversations.length) return;
    const conv = conversations.find(c => c.id === initialConvId);
    if (conv) { openConversation(conv); onConvIdHandled?.(); }
  }, [initialConvId, conversations.length]);

  // Typing timer opruimen bij unmount
  useEffect(() => () => clearTimeout(typingTimer.current), []);

  // Herstel profielfoto uit Firestore als localStorage leeg is
  useEffect(() => {
    if (localStorage.getItem(`pulse_photo_${user.uid}`)) return;
    getDoc(doc(db, 'users', user.uid)).then(d => {
      if (d.exists() && d.data().photoURL) {
        localStorage.setItem(`pulse_photo_${user.uid}`, d.data().photoURL);
        setPhotoPreview(d.data().photoURL);
      }
    }).catch(() => {});
  }, [user.uid]);

  // Laad chat achtergrond + gebruikersnaam uit Firestore bij mount
  useEffect(() => {
    getDoc(doc(db, 'users', user.uid)).then(d => {
      if (!d.exists()) return;
      const { chatBackgroundURL, chatBackgroundColor, username } = d.data();
      if (chatBackgroundURL)        setChatBg({ type: 'photo', url: chatBackgroundURL });
      else if (chatBackgroundColor) setChatBg({ type: 'color', value: chatBackgroundColor });
      if (username) setNewUsername(username);
    }).catch(() => {});
  }, [user.uid]);

  // ── Socket events ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      clearTimeout(disconnectTimerRef.current);
      setConnected(true);
      // Re-join alle kamers + online status opvragen bij (her)verbinding
      conversationsRef.current.forEach(conv => socket.emit('conversation:join', { convId: conv.id }));
      socket.emit('users:online:request');
    };
    const onDisconnect = () => {
      // Wacht 3 seconden voor banner tonen — korte onderbrekingen negeren
      disconnectTimerRef.current = setTimeout(() => setConnected(false), 3000);
    };

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
      // Direct de preview bijwerken zonder te wachten op HTTP-verzoek
      const previewText = msg.type === 'contact'
        ? `Contactpersoon: ${msg.sharedContact?.name || ''}`
        : msg.type === 'call'
          ? (() => {
              const isOwn = msg.senderId === user.uid;
              const iv = msg.isVideo;
              if (msg.direction === 'completed') return iv ? 'Video-oproep' : 'Spraakoproep';
              if (msg.direction === 'declined')  return isOwn ? 'Geweigerd' : (iv ? 'Gemiste video-oproep' : 'Gemiste spraakoproep');
              return isOwn ? 'Geen antwoord' : (iv ? 'Gemiste video-oproep' : 'Gemiste spraakoproep');
            })()
          : (msg.text || '');
      setConversations(prev => {
        const exists = prev.some(c => c.id === msg.convId);
        if (!exists) {
          // Nieuw gesprek niet in state → ophalen van server
          loadConversations();
          return prev;
        }
        const callMeta = msg.type === 'call'
          ? { lastCallSenderId: msg.senderId, lastCallDirection: msg.direction, lastCallIsVideo: !!msg.isVideo }
          : { lastCallDirection: null, lastCallSenderId: null, lastCallIsVideo: null };
        const target = prev.find(c => c.id === msg.convId);
        const rest = prev.filter(c => c.id !== msg.convId);
        return [{ ...target, lastMessage: previewText, updatedAt: msg.createdAt || new Date().toISOString(), ...callMeta }, ...rest];
      });
    };

    const onTypingUpdate = ({ typing, name }) => {
      if (typing) { setTyping(true); setTypingName(name || 'Iemand'); }
      else setTyping(false);
    };

    const onMessageStatus = ({ convId, msgId, status }) => {
      if (status === 'gelezen') {
        // Markeer alle eigen berichten in dit gesprek als gelezen
        setMessages(prev => prev.map(m =>
          m.convId === convId && m.senderId === user.uid ? { ...m, status: 'gelezen' } : m
        ));
      } else if (status === 'bezorgd' && msgId) {
        setMessages(prev => prev.map(m =>
          m.id === msgId && m.status !== 'gelezen' ? { ...m, status: 'bezorgd' } : m
        ));
      }
    };

    const onFriendRequest = (req) => {
      setFriendRequests(prev => [req, ...prev.filter(r => r.id !== req.id)]);
      if (dndRef.current) return;
      // Uitnodigingsgeluid: twee oplopende tonen
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const tones = [[600, 0], [900, 0.18]];
        let ended = 0;
        tones.forEach(([freq, delay]) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
          gain.gain.setValueAtTime(0.18, ctx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.25);
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + 0.25);
          osc.onended = () => { if (++ended === tones.length) { try { ctx.close(); } catch {} } };
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

    const onMessageDeleted = ({ msgId }) => {
      setMessages(prev => prev.filter(m => m.id !== msgId));
    };

    const onMessageEdited = ({ msgId, text, editedAt }) => {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text, editedAt } : m));
    };

    const onMessageReaction = ({ msgId, reactions }) => {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions } : m));
    };

    const onAccountPaused  = ({ features } = {}) => setPausedFeatures(features || { chat: true, call: true, video: true });
    const onAccountResumed = ({ features } = {}) => setPausedFeatures(features || { chat: false, call: false, video: false });

    const onMentionNotify = ({ senderName, groupName, convId: mConvId }) => {
      if (dndRef.current) return;
      setMentionToast({ senderName, groupName });
      setTimeout(() => setMentionToast(null), 4000);
    };

    socket.on('connect',          onConnect);
    socket.on('disconnect',       onDisconnect);
    socket.on('message:received', onMessageReceived);
    socket.on('typing:update',    onTypingUpdate);
    socket.on('message:status',   onMessageStatus);
    socket.on('friend:request',   onFriendRequest);
    socket.on('friend:accepted',  onFriendAccepted);
    socket.on('user:updated',     onUserUpdated);
    socket.on('message:deleted',  onMessageDeleted);
    socket.on('message:edited',   onMessageEdited);
    socket.on('message:reaction', onMessageReaction);
    socket.on('account:paused',   onAccountPaused);
    socket.on('account:resumed',  onAccountResumed);
    socket.on('mention:notify',   onMentionNotify);

    return () => {
      socket.off('connect',          onConnect);
      socket.off('disconnect',       onDisconnect);
      socket.off('message:received', onMessageReceived);
      socket.off('typing:update',    onTypingUpdate);
      socket.off('message:status',   onMessageStatus);
      socket.off('friend:request',   onFriendRequest);
      socket.off('friend:accepted',  onFriendAccepted);
      socket.off('message:deleted',  onMessageDeleted);
      socket.off('message:edited',   onMessageEdited);
      socket.off('message:reaction', onMessageReaction);
      socket.off('account:paused',   onAccountPaused);
      socket.off('account:resumed',  onAccountResumed);
      socket.off('user:updated',     onUserUpdated);
      socket.off('mention:notify',   onMentionNotify);
    };
  }, [socket, loadConversations, loadContacts]);

  // ── Inactiviteitsdetectie: na 1 minuut geen activiteit → user:inactive ──────
  useEffect(() => {
    if (!socket) return;
    let isInactive = false;
    let timer = null;
    const onActivity = () => {
      clearTimeout(timer);
      if (isInactive) { isInactive = false; socket.emit('user:active'); }
      timer = setTimeout(() => { isInactive = true; socket.emit('user:inactive'); }, 60_000);
    };
    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    events.forEach(e => document.addEventListener(e, onActivity, { passive: true }));
    onActivity(); // start timer direct
    return () => { clearTimeout(timer); events.forEach(e => document.removeEventListener(e, onActivity)); };
  }, [socket]);

  // Sluit delete menu bij klik buiten
  useEffect(() => {
    if (!deleteMenuMsgId) return;
    const close = () => setDeleteMenuMsgId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [deleteMenuMsgId]);

  // Sluit reactie-picker bij klik buiten
  useEffect(() => {
    if (!reactionPickerMsgId) return;
    const close = () => setReactionPickerMsgId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [reactionPickerMsgId]);

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
    if (dndRef.current) return;
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
          await authFetch(`${BACKEND_URL}/api/conversations/${convId}`, { method: 'DELETE' });
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
    socket?.emit('messages:read', { convId: conv.id });
    try {
      const res  = await authFetch(`${BACKEND_URL}/api/messages/${conv.id}?limit=${MSG_LIMIT}&offset=0`);
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
      const res  = await authFetch(`${BACKEND_URL}/api/messages/${activeConv.id}?limit=${MSG_LIMIT}&offset=${msgOffset}`);
      const data = await res.json();
      const arr  = Array.isArray(data) ? data : [];
      setMessages(prev => [...arr, ...prev]);
      setMsgOffset(prev => prev + arr.length);
      setHasMore(arr.length === MSG_LIMIT);
    } catch (e) { console.error(e); }
    finally { setLoadingMore(false); }
  }

  // ── Bericht doorsturen ────────────────────────────────────────────────────
  function forwardToConv(conv) {
    if (!socket?.connected || !forwardMsg) return;
    const msg = {
      convId:     conv.id,
      senderId:   user.uid,
      senderName: user.displayName || user.email,
      text:       `↪️ ${forwardMsg.text}`,
      createdAt:  new Date().toISOString(),
    };
    socket.emit('message:send', { convId: conv.id, message: msg });
    setForwardMsg(null);
    showErrToast('📋 Bericht doorgestuurd');
  }

  // ── Emoji-reactie ─────────────────────────────────────────────────────────
  function toggleReaction(msgId, emoji) {
    if (!socket?.connected || !activeConv) return;
    socket.emit('message:react', { convId: activeConv.id, msgId, emoji });
    setReactionPickerMsgId(null);
  }

  // ── Bericht bewerken ──────────────────────────────────────────────────────
  function sendEditedMessage() {
    if (!editingMsg || !text.trim() || !socket?.connected) return;
    const trimmed = text.trim();
    socket.emit('message:edit', { convId: activeConv.id, msgId: editingMsg.id, newText: trimmed }, (res) => {
      if (res?.error) return showErrToast(res.error);
      setMessages(prev => prev.map(m => m.id === editingMsg.id ? { ...m, text: trimmed, editedAt: new Date().toISOString() } : m));
    });
    setEditingMsg(null);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  // ── Bericht versturen ─────────────────────────────────────────────────────
  function sendMessage() {
    if (editingMsg) return sendEditedMessage();
    if (!text.trim() || !activeConv) return;
    if (!socket?.connected) {
      showErrToast('Geen verbinding. Controleer je internet en probeer opnieuw.');
      return;
    }
    const tempId = `temp-${Date.now()}`;
    const trimmedText = text.trim();
    const mentions = pendingMentions
      .filter(m => trimmedText.includes(`@${m.displayName}`))
      .map(m => m.uid);
    const msg = {
      convId:     activeConv.id,
      senderId:   user.uid,
      senderName: user.displayName || user.email,
      text:       trimmedText,
      createdAt:  new Date().toISOString(),
      ...(replyTo   ? { replyTo }          : {}),
      ...(mentions.length > 0 ? { mentions } : {}),
    };
    setReplyTo(null);
    // Optimistic UI: toon bericht direct zonder te wachten op server
    setMessages(prev => [...prev, { ...msg, id: tempId, _key: tempId, pending: true }]);
    setTimeout(() => { if (msgsAreaRef.current) msgsAreaRef.current.scrollTop = msgsAreaRef.current.scrollHeight; }, 50);
    // Preview in conversatielijst direct bijwerken
    setConversations(prev => {
      const updated = prev.map(c => c.id === activeConv.id ? { ...c, lastMessage: msg.text, updatedAt: msg.createdAt, lastCallDirection: null, lastCallSenderId: null, lastCallIsVideo: null } : c);
      return [...updated].sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt));
    });
    socket.emit('message:send', { convId: activeConv.id, message: msg }, (savedMsg) => {
      // Vervang tijdelijk bericht met bevestigd bericht van server
      if (savedMsg?.id) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...savedMsg, _key: tempId, pending: false } : m));
      }
    });
    setText('');
    setPendingMentions([]);
    setMentionSuggestions([]);
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
    stopTyping();
  }

  function insertMention(member) {
    const cursorPos = textareaRef.current?.selectionStart ?? text.length;
    const textBefore = text.slice(0, cursorPos);
    const atMatch = textBefore.match(/@([^\s@]*)$/);
    if (!atMatch) return;
    const start = cursorPos - atMatch[0].length;
    const newText = text.slice(0, start) + `@${member.displayName} ` + text.slice(cursorPos);
    setText(newText);
    setPendingMentions(prev => prev.find(m => m.uid === member.uid) ? prev : [...prev, { uid: member.uid, displayName: member.displayName }]);
    setMentionSuggestions([]);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function handleKeyDown(e) {
    if (mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionSelIdx(i => Math.min(i + 1, mentionSuggestions.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionSelIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(mentionSuggestions[mentionSelIdx]); return; }
      if (e.key === 'Escape')    { setMentionSuggestions([]); return; }
    }
    if (e.key === 'Escape' && editingMsg) { setEditingMsg(null); setText(''); return; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function handleTyping(val) {
    setText(val);
    // @mention detectie
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
    if (!activeConv) return;
    socket?.emit('typing:start', { convId: activeConv.id, name: user.displayName });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, 2000);
  }

  function stopTyping() {
    clearTimeout(typingTimer.current);
    if (activeConv) socket?.emit('typing:stop', { convId: activeConv.id });
  }

  // ── Vriendschapsverzoek sturen ────────────────────────────────────────────
  async function addContact() {
    setContactErr(''); setContactLoading(true);
    try {
      const res  = await authFetch(`${BACKEND_URL}/api/friend-requests`, {
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
      const res = await authFetch(`${BACKEND_URL}/api/friend-requests`, {
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
      await authFetch(`${BACKEND_URL}/api/friend-requests/${requestId}/accept`, { method: 'POST' });
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
      loadContacts();
    } catch (e) { console.error(e); }
  }

  // ── Vriendschapsverzoek weigeren ──────────────────────────────────────────
  async function declineFriendRequest(requestId) {
    try {
      await authFetch(`${BACKEND_URL}/api/friend-requests/${requestId}/decline`, { method: 'POST' });
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
          try { await authFetch(`${BACKEND_URL}/api/conversations/${conv.id}`, { method: 'DELETE' }); } catch {}
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
      if (error) return showErrToast(error);
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
      const res  = await authFetch(`${BACKEND_URL}/api/users/search?email=${encodeURIComponent(searchEmail.trim())}`);
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
      if (error) return showErrToast(error);
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
      if (res.error) return showErrToast(res.error);
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
          if (res.error) return showErrToast(res.error);
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
      if (error) return showErrToast(error);
      const conv = { id: convId, members: memberUids, memberNames, isGroup: true, groupName: groupName.trim(), creatorId: user.uid };
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

  function dataURLtoBlob(dataURL) {
    const [header, data] = dataURL.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const bstr = atob(data);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
    return new Blob([u8arr], { type: mime });
  }

  // ── Profielfoto resizen naar base64 (geen externe opslag nodig) ──────────
  function resizeBgImage(file, maxWidth = 1920) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

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
    setPhotoPreview(prev => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    e.target.value = '';
  }

  // ── Profiel opslaan ───────────────────────────────────────────────────────
  async function saveProfile(e) {
    e?.preventDefault();
    if (!newName.trim()) return;
    setProfileLoading(true); setProfileMsg('');
    const hadPhoto = !!photoFile;
    try {
      let photoURL = localStorage.getItem(`pulse_photo_${user.uid}`) || user.photoURL || null;
      if (photoFile) {
        // Verwijder oude foto uit Storage (als die er is)
        try { await deleteObject(storageRef(storage, `users/${user.uid}/profilePhoto`)); } catch {}
        // Upload nieuwe foto naar Storage
        const ref = storageRef(storage, `users/${user.uid}/profilePhoto`);
        const resized = await resizeImageToBase64(photoFile, 200);
        const blob = dataURLtoBlob(resized);
        await uploadBytes(ref, blob, { contentType: 'image/jpeg' });
        photoURL = await getDownloadURL(ref);
        localStorage.setItem(`pulse_photo_${user.uid}`, photoURL);
      }
      await fbUpdateProfile(auth.currentUser, { displayName: newName.trim(), photoURL: photoURL || null });
      // Sync naar backend zodat anderen de nieuwe foto/naam zien
      authFetch(`${BACKEND_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, displayName: newName.trim(), email: user.email, photoURL: photoURL || '' }),
      }).catch(() => {});
      // Broadcast profielupdate zodat contacten live worden bijgewerkt
      socket?.emit('user:updated', { uid: user.uid, displayName: newName.trim(), photoURL: photoURL || '' });
      setPhotoFile(null);
      setPhotoPreview(photoURL);
      setProfileMsg(hadPhoto ? 'Profielfoto opgeslagen!' : 'Opgeslagen!');
    } catch (err) { setProfileMsg('Fout bij opslaan: ' + (err.message || err.code)); }
    finally { setProfileLoading(false); }
  }

  // ── Gebruikersnaam opslaan ────────────────────────────────────────────────
  async function saveUsername() {
    const clean = newUsername.trim().toLowerCase();
    if (!clean) { setUsernameMsg('Fout: Gebruikersnaam mag niet leeg zijn.'); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) { setUsernameMsg('Fout: 3–20 tekens, alleen letters, cijfers en _.'); return; }
    setUsernameLoading(true); setUsernameMsg('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/lookup-username?username=${encodeURIComponent(clean)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.email !== user.email) { setUsernameMsg('Fout: Gebruikersnaam is al in gebruik.'); return; }
      }
      await updateDoc(doc(db, 'users', user.uid), { username: clean });
      setUsernameMsg('Gebruikersnaam opgeslagen!');
    } catch (err) { setUsernameMsg('Fout: ' + err.message); }
    finally { setUsernameLoading(false); }
  }

  // ── Wachtwoord wijzigen ───────────────────────────────────────────────────
  async function changePassword() {
    if (newPassword.length < 6)          { setPasswordMsg('Fout: Minimaal 6 tekens.'); return; }
    if (newPassword !== confirmPassword) { setPasswordMsg('Fout: Wachtwoorden komen niet overeen.'); return; }
    setPasswordLoading(true); setPasswordMsg('');
    try {
      await updatePassword(auth.currentUser, newPassword);
      setNewPassword(''); setConfirmPassword('');
      setPasswordMsg('Wachtwoord gewijzigd!');
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') setPasswordMsg('Fout: Log opnieuw in om je wachtwoord te wijzigen.');
      else setPasswordMsg('Fout: ' + err.message);
    } finally { setPasswordLoading(false); }
  }

  // ── Chat achtergrond functies ─────────────────────────────────────────────
  async function uploadChatBgPhoto(file) {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
    if (!ALLOWED.includes(file.type)) { setChatBgMsg('Fout: alleen JPG, PNG of WEBP toegestaan.'); return; }
    if (file.size > 5 * 1024 * 1024)  { setChatBgMsg('Fout: bestand te groot (max 5 MB).'); return; }
    setChatBgLoading(true); setChatBgMsg('');
    try {
      // Verwijder oude foto als die bestaat
      await deleteObject(storageRef(storage, `users/${user.uid}/chatBackground`)).catch(() => {});
      // Upload nieuwe foto
      const ref = storageRef(storage, `users/${user.uid}/chatBackground`);
      await uploadBytes(ref, file);
      const url = await getDownloadURL(ref);
      // Sla URL op in Firestore
      await updateDoc(doc(db, 'users', user.uid), { chatBackgroundURL: url, chatBackgroundColor: null });
      setChatBg({ type: 'photo', url });
      setChatBgMsg('Achtergrond opgeslagen!');
    } catch (err) { setChatBgMsg('Fout bij uploaden: ' + err.message); }
    finally { setChatBgLoading(false); }
  }

  async function saveChatBgColor(color) {
    setChatBgLoading(true); setChatBgMsg('');
    try {
      // Verwijder eventuele foto
      await deleteObject(storageRef(storage, `users/${user.uid}/chatBackground`)).catch(() => {});
      await updateDoc(doc(db, 'users', user.uid), { chatBackgroundURL: null, chatBackgroundColor: color });
      setChatBg({ type: 'color', value: color });
    } catch (err) { setChatBgMsg('Fout bij opslaan: ' + err.message); }
    finally { setChatBgLoading(false); }
  }

  async function removeChatBg() {
    setChatBgLoading(true); setChatBgMsg('');
    try {
      await deleteObject(storageRef(storage, `users/${user.uid}/chatBackground`)).catch(() => {});
      await updateDoc(doc(db, 'users', user.uid), { chatBackgroundURL: null, chatBackgroundColor: null });
      setChatBg(null);
    } catch (err) { setChatBgMsg('Fout bij verwijderen: ' + err.message); }
    finally { setChatBgLoading(false); }
  }

  // ── Account verwijderen ───────────────────────────────────────────────────
  function handleDeleteAccount() {
    setConfirmDialog({
      message: 'Weet je zeker dat je je account wilt verwijderen? Al je chats en gegevens worden permanent verwijderd.',
      onConfirm: async () => {
        try {
          await authFetch(`${BACKEND_URL}/api/account/${user.uid}`, { method: 'DELETE' });
          localStorage.removeItem(`pulse_photo_${user.uid}`);
          localStorage.removeItem(`pulse_calls_${user.uid}`);
          await signOut(auth);
        } catch (err) {
          showErrToast('Verwijderen mislukt: ' + err.message);
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

  async function deleteMessage(msgId, scope) {
    setDeleteMenuMsgId(null);
    try {
      await authFetch(`${BACKEND_URL}/api/messages/${activeConv.id}/${msgId}?scope=${scope}`, { method: 'DELETE' });
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch (e) { console.error('Verwijderen mislukt:', e); }
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
  // ── Gedeelde bel-logica ───────────────────────────────────────────────────
  async function startCallTo({ toUid, convId, name, isVideo }) {
    if (isVideo ? pausedFeatures.video : pausedFeatures.call) {
      const canChat  = !pausedFeatures.chat;
      const canCall  = !pausedFeatures.call;
      const canVideo = !pausedFeatures.video;
      const available = [canChat && 'chatten', canCall && 'bellen', canVideo && 'videobellen'].filter(Boolean).join(' en ');
      showErrToast(`⏸ ${isVideo ? 'Videobellen' : 'Bellen'} is gepauzeerd door je ouder${available ? `, maar je kan nog wel ${available}` : ''}.`);
      return;
    }
    callConvIdRef.current    = convId;
    callStartTimeRef.current = null;
    callIsVideoRef.current   = isVideo;
    try {
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
            : (!wasConnected || reason === 'timeout' || reason === 'unavailable' || reason === 'busy') ? 'no-answer'
            : 'completed';
          if (reason !== 'busy') {
            sendCallMessage({ isVideo: callIsVideoRef.current, direction: callDir, duration });
          }
          if (reason === 'unavailable' || reason === 'declined' || reason === 'timeout' || reason === 'busy') {
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
    } catch (err) {
      showErrToast(err.message);
    }
  }

  async function callContact(contact, isVideo) {
    setShowCallModal(false);
    const toUid = contact.uid;
    const name  = contact.displayName;
    logCall({ uid: toUid, name, photoURL: contact.photoURL, isVideo, direction: 'outgoing' });
    await startCallTo({ toUid, convId: findConvWithUid(toUid)?.id || null, name, isVideo });
  }

  // ── Bellen ────────────────────────────────────────────────────────────────
  async function initiateCall(isVideo) {
    if (!activeConv || !Array.isArray(activeConv.members)) return;
    const toUid = activeConv.members.find(m => m !== user.uid);
    if (!toUid) return;
    const name  = activeConv.memberNames?.[toUid] || 'Contactpersoon';
    const photo = contacts.find(c => c.uid === toUid)?.photoURL || '';
    logCall({ uid: toUid, name, photoURL: photo, isVideo, direction: 'outgoing' });
    await startCallTo({ toUid, convId: activeConv.id, name, isVideo });
  }

  // ── Bellen vanuit conv-lijst (zonder chat openen) ────────────────────────
  async function initiateCallFromConv(conv, isVideo) {
    if (!Array.isArray(conv.members)) return;
    const toUid = conv.members.find(m => m !== user.uid);
    if (!toUid) return;
    const name  = conv.memberNames?.[toUid] || 'Contactpersoon';
    const photo = contacts.find(c => c.uid === toUid)?.photoURL || '';
    logCall({ uid: toUid, name, photoURL: photo, isVideo, direction: 'outgoing' });
    await startCallTo({ toUid, convId: conv.id, name, isVideo });
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


  function renderMsgText(text, mentions, memberNames) {
    // Split on @word boundaries; highlight if uid in mentions array
    const parts = text.split(/(@\S+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@') && mentions?.length) {
        const name = part.slice(1).replace(/[^\w\s]/g, '');
        const matched = mentions.find(uid => (memberNames?.[uid] || '').toLowerCase() === name.toLowerCase());
        if (matched) return <span key={i} className="mention-tag">{part}</span>;
      }
      return part;
    });
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
    if (!activeConv) return [];
    const items = [];
    let lastDate = null;
    const searchMatches = chatSearch.trim()
      ? messages.filter(m => m.text?.toLowerCase().includes(chatSearch.toLowerCase()))
      : [];
    const focusedMsgId = searchMatches[chatSearchIdx % (searchMatches.length || 1)]?.id;

    messages.forEach((msg, i) => {
      const label = formatDateLabel(msg.createdAt);
      if (label && label !== lastDate && msg.type !== 'call' && msg.type !== 'contact') {
        lastDate = label;
        items.push(<div key={`date-${i}`} className="msg-date-sep"><span>{label}</span></div>);
      } else if (label && label !== lastDate) {
        lastDate = label;
      }
      const isOwn = msg.senderId === user.uid;
      const isFocused = msg.id === focusedMsgId;

      // ── Call berichten ──
      if (msg.type === 'contact') {
        const sc = msg.sharedContact || {};
        const isAlreadyContact = contacts.some(c => c.uid === sc.uid);
        items.push(
          <div key={msg._key || msg.id || i} className={`msg-group ${isOwn ? 'out' : 'in'}`}>
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
          <div key={msg._key || msg.id || i} className={`msg-group ${isOwn ? 'out' : 'in'}`}
            ref={isFocused ? el => el?.scrollIntoView({ behavior:'smooth', block:'center' }) : null}>
            <div
              className={`msg-call-card ${isOwn ? 'out' : 'in'}${isMissed ? ' missed' : ''}`}
              onClick={isMissed ? () => startCallTo({ toUid: msg.senderId, convId: activeConv.id, name: msg.senderName, isVideo: msg.isVideo }) : undefined}
              style={isMissed ? { cursor: 'pointer' } : undefined}
            >
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
        <div key={msg._key || msg.id || i} className={`msg-group ${isOwn ? 'out' : 'in'}`}
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
              {chatSearch.trim()
                ? highlightText(msg.text || '', chatSearch)
                : renderMsgText(msg.text || '', msg.mentions, activeConv?.memberNames)}
              {msg.editedAt && <span className="msg-edited">(bewerkt)</span>}
            </div>
            <button className="msg-reply-btn" onClick={() => { setReplyTo({ id: msg.id, text: msg.text, senderName: msg.senderName }); textareaRef.current?.focus(); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
            </button>
            <div className="msg-react-wrap">
              <button className="msg-react-btn" onClick={(e) => { e.stopPropagation(); setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id); }}>😊</button>
              {reactionPickerMsgId === msg.id && (
                <div className="msg-react-picker" onClick={e => e.stopPropagation()}>
                  {['❤️','👍','😂','😮','😢','👎'].map(emoji => (
                    <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}>{emoji}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="msg-delete-wrap">
              <button className="msg-delete-btn" onClick={(e) => { e.stopPropagation(); setDeleteMenuMsgId(deleteMenuMsgId === msg.id ? null : msg.id); }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
              {deleteMenuMsgId === msg.id && (
                <div className="msg-delete-menu" onClick={e => e.stopPropagation()}>
                  {!msg.type && (
                    <button onClick={() => { navigator.clipboard.writeText(msg.text || '').then(() => showErrToast('📋 Bericht gekopieerd')).catch(() => {}); setDeleteMenuMsgId(null); }}>📋 Kopiëren</button>
                  )}
                  {!msg.type && (
                    <button onClick={() => { setForwardMsg({ text: msg.text }); setDeleteMenuMsgId(null); }}>↪️ Doorsturen</button>
                  )}
                  {isOwn && !msg.type && (
                    <button onClick={() => { setEditingMsg({ id: msg.id, text: msg.text }); setText(msg.text); setDeleteMenuMsgId(null); setTimeout(() => textareaRef.current?.focus(), 0); }}>✏️ Bewerken</button>
                  )}
                  <button onClick={() => deleteMessage(msg.id, 'self')}>Voor mezelf</button>
                  {isOwn && <button onClick={() => deleteMessage(msg.id, 'all')}>Voor iedereen</button>}
                </div>
              )}
            </div>
          </div>
          {msg.reactions && Object.entries(msg.reactions).some(([, uids]) => uids?.length > 0) && (
            <div className="msg-reactions">
              {Object.entries(msg.reactions)
                .filter(([, uids]) => uids?.length > 0)
                .map(([emoji, uids]) => (
                  <button key={emoji} className={`msg-reaction-pill${uids.includes(user.uid) ? ' mine' : ''}`}
                    onClick={() => toggleReaction(msg.id, emoji)}>
                    {emoji}{uids.length > 1 && <span>{uids.length}</span>}
                  </button>
                ))}
            </div>
          )}
          <div className="msg-time">
            {formatTime(msg.createdAt)}
            {isOwn && (() => {
              const isPending   = msg.pending;
              const isRead      = msg.status === 'gelezen';
              const isDelivered = isRead || msg.status === 'bezorgd';
              const label = isPending ? 'verstuurd' : isRead ? 'gelezen' : isDelivered ? 'bezorgd' : 'verstuurd';
              return (
                <span className={`msg-ticks ${isRead ? 'read' : ''}`}>
                  {isPending ? <Clock size={12} /> : isRead ? <CheckDouble size={12} /> : isDelivered ? <CheckDouble size={12} /> : <Check size={12} />}
                  <span className="msg-ticks-label">{label}</span>
                </span>
              );
            })()}
          </div>
        </div>
      );
    });
    return items;
  }

  // eslint-disable-next-line
  const renderedMessages = useMemo(() => renderMessages(), [messages, chatSearch, chatSearchIdx, activeConv?.id, activeConv?.isGroup, activeConv?.memberNames, deleteMenuMsgId, editingMsg, reactionPickerMsgId, contacts]);

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
              <button className={`icon-btn${dnd ? ' dnd-active' : ''}`} onClick={toggleDnd} title={dnd ? 'Meldingen inschakelen' : 'Niet gestoord'}>
                {dnd ? <BellOff size={18} /> : <Bell size={18} />}
              </button>
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

        {/* ── CHAT FILTERS ── */}
        {activeTab === 'chats' && (
          <div className="chat-filters">
            {['all', 'familie', 'vrienden'].map(f => (
              <button key={f} className={`chat-filter-chip${chatFilter === f ? ' active' : ''}`} onClick={() => setChatFilter(f)}>
                {f === 'all' ? 'Alles' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* ── CHATS TAB ── */}
        {activeTab === 'chats' && (
          <div className="conv-list" onClick={() => setLabelMenuConvId(null)}>
            {conversations.length === 0 && (
              <div className="empty-convs">
                <p>Nog geen gesprekken.</p>
                <p>Klik op het <Message size={14} color="#ffffff" style={{ verticalAlign: 'middle', margin: '0 2px' }} /> om een nieuwe chat te starten.</p>
              </div>
            )}
            {conversations.filter(conv => {
              const matchSearch = !searchQuery.trim() ||
                getConvName(conv).toLowerCase().includes(searchQuery.toLowerCase()) ||
                (conv.lastMessage || '').toLowerCase().includes(searchQuery.toLowerCase());
              const matchFilter = chatFilter === 'all' || convLabels[conv.id] === chatFilter;
              return matchSearch && matchFilter;
            }).map(conv => {
              const otherUid        = getOtherUid(conv);
              const isOnline        = otherUid && onlineUsers.has(otherUid);
              const isActivelyOnline = isOnline && !inactiveUsers.has(otherUid);
              const unread          = unreadCounts[conv.id] || 0;
              return (
                <div key={conv.id} className={`conv-item ${activeConv?.id === conv.id ? 'active' : ''}`} onClick={() => openConversation(conv)}>
                  <div className="avatar-wrap">
                    <UserAvatar photoURL={getConvPhoto(conv)} displayName={getConvName(conv)} />
                    {isOnline && <span className={`online-dot${inactiveUsers.has(otherUid) ? ' inactive' : ''}`} />}
                  </div>
                  <div className="conv-info">
                    <div className="conv-name">{getConvName(conv)}</div>
                    <div className="conv-preview">{conv.lastCallDirection ? callPreview(conv, user.uid) : (conv.lastMessage || 'Start een gesprek…')}</div>
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
                    {onlineUsers.has(contact.uid) && <span className={`online-dot${inactiveUsers.has(contact.uid) ? ' inactive' : ''}`} />}
                  </div>
                  <div className="conv-info">
                    <div className="conv-name">{getContactDisplayName(contact)}</div>
                    <div className="conv-preview">{contact.email}</div>
                  </div>
                </div>
                <div style={{ height: '1px', background: 'var(--border)' }} />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="icon-btn" onClick={() => { setViewingContact(contact); setRenameValue(getContactNickname(contact.uid) || contact.displayName || ''); }} title="Profiel bekijken" style={{ flex:1, justifyContent:'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M12 14c-6 0-8 2.5-8 4v1h16v-1c0-1.5-2-4-8-4z"/></svg>
                  </button>
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
          <div className="user-chip" style={{ cursor:'pointer' }} onClick={async () => { setShowProfile(true); setProfileMsg(''); setNewName(user.displayName || ''); setPhotoPreview(localStorage.getItem(`pulse_photo_${user.uid}`) || user.photoURL || null); setPhotoFile(null); try { const snap = await getDoc(doc(db,'users',user.uid)); if(snap.exists() && snap.data().avatarOptions) setAvatarOptions(snap.data().avatarOptions); } catch {} }}>
            <div className="avatar-wrap" style={{ flexShrink:0 }}>
              <UserAvatar photoURL={localStorage.getItem(`pulse_photo_${user.uid}`) || user.photoURL} displayName={user.displayName || user.email} className="sm" />
            </div>
            <div className="user-chip-info">
              <div className="user-chip-name">{user.displayName || user.email.split('@')[0]}</div>
              <div className="user-chip-status">Online</div>
            </div>
          </div>
          {isParent && (
            <button className="icon-btn parent-dashboard-btn" onClick={onOpenDashboard} title="Ouderlijk toezicht" style={{ position:'relative' }}>
              <Shield size={18} />
              {parentActivityBadge > 0 && (
                <span className="parent-badge">{parentActivityBadge > 9 ? '9+' : parentActivityBadge}</span>
              )}
            </button>
          )}
          <button className="icon-btn" onClick={onToggleTheme} title={lightMode ? 'Donker thema' : 'Licht thema'}>{lightMode ? <Moon size={18} /> : <Lightbulb size={18} />}</button>
          <button className="icon-btn danger" onClick={() => signOut(auth)} title="Uitloggen"><Logout size={18} /></button>
        </div>
      </aside>

      {/* ── CHAT MAIN ── */}
      <main className="chat-main">
        {!activeConv ? (
          <div className="empty-state">
            <div className="empty-icon"><Message size={48} /></div>
            <div className="empty-title">Kies een gesprek</div>
            <p>Of klik op het <Message size={14} style={{ verticalAlign: 'middle', margin: '0 2px', color: '#fff' }} /> om een nieuwe chat te beginnen.</p>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <button className="back-btn" onClick={() => setActiveConv(null)} title="Terug">←</button>
              {(() => {
                const hOtherUid = getOtherUid(activeConv);
                const hIsOnline = hOtherUid && onlineUsers.has(hOtherUid);
                const hIsActive = hIsOnline && !inactiveUsers.has(hOtherUid);
                return (
                  <>
                    <div className="avatar-wrap" style={{ cursor: !activeConv.isGroup ? 'pointer' : 'default' }} onClick={() => { if (!activeConv.isGroup) { setRenameValue(getContactNickname(hOtherUid) || getConvName(activeConv)); setShowContactProfile(true); } }}>
                      <UserAvatar photoURL={getConvPhoto(activeConv)} displayName={getConvName(activeConv)} className="sm" />
                      {hIsOnline && <span className={`online-dot sm${inactiveUsers.has(hOtherUid) ? ' inactive' : ''}`} />}
                    </div>
                    <div className="chat-header-info" style={{ cursor: !activeConv.isGroup ? 'pointer' : 'default' }} onClick={() => { if (!activeConv.isGroup) { setRenameValue(getContactNickname(hOtherUid) || getConvName(activeConv)); setShowContactProfile(true); } }}>
                      <div className="chat-header-name">{getConvName(activeConv)}</div>
                      {typing
                        ? <div className="chat-header-typing">● {typingName} typt…</div>
                        : hIsOnline
                          ? <div className="chat-header-online">{hIsActive ? 'Online' : 'Inactief'}</div>
                          : null
                      }
                    </div>
                    <div className="chat-header-actions">
                      {!activeConv.isGroup && (
                        <>
                          <button className="call-btn voice" onClick={() => initiateCall(false)} title="Bellen"><Phone size={18} /></button>
                          <button className="call-btn video" onClick={() => initiateCall(true)} title="Videobellen"><Video size={18} /></button>
                        </>
                      )}
                      {activeConv.isGroup && (
                        <button className="icon-btn" onClick={() => setShowGroupInfo(true)} title="Groepsinformatie"><Users size={18} /></button>
                      )}
                      <button className="icon-btn" onClick={() => { setShowChatSearch(s => !s); setChatSearch(''); setChatSearchIdx(0); setTimeout(() => chatSearchRef.current?.focus(), 50); }} title="Zoeken">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                      </button>
                    </div>
                  </>
                );
              })()}
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
                      <button aria-label="Vorig resultaat" className="icon-btn" style={{ width:'30px', height:'30px', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setChatSearchIdx(i => (i - 1 + total) % total)}>↑</button>
                      <button aria-label="Volgend resultaat" className="icon-btn" style={{ width:'30px', height:'30px', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setChatSearchIdx(i => (i + 1) % total)}>↓</button>
                    </>
                  )}
                  <button aria-label="Zoeken sluiten" className="icon-btn" style={{ width:'30px', height:'30px', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => { setShowChatSearch(false); setChatSearch(''); }}>✕</button>
                </div>
              );
            })()}

            <div className={`messages-area${chatBg ? ' has-chat-bg' : ''}`} ref={msgsAreaRef}
              style={chatBg?.type === 'photo' ? { backgroundImage:`url(${chatBg.url})`, backgroundSize:'cover', backgroundPosition:'center', backgroundAttachment:'local' }
                   : chatBg?.type === 'color' ? { background: chatBg.value } : {}}
              onClick={() => { if (showChatSearch) { setShowChatSearch(false); setChatSearch(''); } }}>
              {/* Meer berichten laden (5) */}
              {hasMore && (
                <div style={{ textAlign:'center', padding:'8px 0' }}>
                  <button className="load-more-btn" onClick={loadMoreMessages} disabled={loadingMore}>
                    {loadingMore ? 'Laden…' : '↑ Meer berichten laden'}
                  </button>
                </div>
              )}
              {renderedMessages}
              <div ref={msgEndRef} />
            </div>

            <div className="chat-input-area">
              {editingMsg && (
                <div className="reply-preview">
                  <div className="reply-preview-inner">
                    <span className="reply-preview-name">✏️ Bewerken</span>
                    <span className="reply-preview-text">{editingMsg.text}</span>
                  </div>
                  <button className="reply-preview-close" onClick={() => { setEditingMsg(null); setText(''); }}>✕</button>
                </div>
              )}
              {replyTo && (
                <div className="reply-preview">
                  <div className="reply-preview-inner">
                    <span className="reply-preview-name">{replyTo.senderName}</span>
                    <span className="reply-preview-text">{replyTo.text}</span>
                  </div>
                  <button className="reply-preview-close" onClick={() => setReplyTo(null)}>✕</button>
                </div>
              )}
              {mentionSuggestions.length > 0 && (
                <div className="mention-popup">
                  {mentionSuggestions.map((m, i) => (
                    <button
                      key={m.uid}
                      className={`mention-item${i === mentionSelIdx ? ' selected' : ''}`}
                      onMouseDown={e => { e.preventDefault(); insertMention(m); }}
                    >
                      <div className="mention-avatar">
                        {m.photoURL
                          ? <img src={m.photoURL} alt={m.displayName} style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover' }} loading="lazy" />
                          : <span>{m.displayName?.[0]?.toUpperCase() || '?'}</span>
                        }
                      </div>
                      <span className="mention-name">{m.displayName}</span>
                    </button>
                  ))}
                </div>
              )}
              {pausedFeatures.chat ? (
                <div className="chat-paused-notice">
                  ⏸ Chatten is gepauzeerd door je ouder{(!pausedFeatures.call || !pausedFeatures.video) ? `, maar je kan nog wel ${[!pausedFeatures.call && 'bellen', !pausedFeatures.video && 'videobellen'].filter(Boolean).join(' en ')}` : ''}.
                </div>
              ) : (
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
              )}
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
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:400, width:'100%' }}>
            <h3 className="modal-title" style={{ display:'flex', alignItems:'center', gap:'10px', fontSize:'18px' }}><User size={20} style={{ flexShrink:0 }} /> Contactpersoon</h3>
            <div style={{ display:'flex', alignItems:'center', gap:'14px', padding:'16px 0 20px' }}>
              <div className="avatar-wrap" style={{ flexShrink:0 }}>
                <div className="avatar-circle" style={{ width:52, height:52, fontSize:20, borderRadius:14 }}>{getInitials(viewingSharedContact.name || '')}</div>
                {viewingSharedContact.uid && onlineUsers.has(viewingSharedContact.uid) && <span className={`online-dot${inactiveUsers.has(viewingSharedContact.uid) ? ' inactive' : ''}`} />}
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:'16px' }}>{viewingSharedContact.name || 'Onbekend'}</div>
                {viewingSharedContact.email && <div style={{ fontSize:'13px', color:'var(--text3)', marginTop:2 }}>{viewingSharedContact.email}</div>}
                <div style={{ fontSize:'12px', marginTop:4, display:'flex', alignItems:'center', gap:5 }}>
                  {viewingSharedContact.uid && onlineUsers.has(viewingSharedContact.uid)
                    ? inactiveUsers.has(viewingSharedContact.uid)
                      ? <><span style={{ width:7, height:7, borderRadius:'50%', background:'#f59e0b', display:'inline-block' }} /> <span style={{ color:'#f59e0b' }}>Inactief</span></>
                      : <><span style={{ width:7, height:7, borderRadius:'50%', background:'var(--success)', display:'inline-block' }} /> <span style={{ color:'var(--success)' }}>Online</span></>
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
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
              <h3 className="modal-title" style={{ margin:0 }}><User size={18} /> Profiel</h3>
              <button className="icon-btn" onClick={() => { setSharingContact(viewingContact); setViewingContact(null); }} title="Contactpersoon delen"><Share size={18} /></button>
            </div>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:'20px' }}>
              {viewingContact.photoURL
                ? <img src={viewingContact.photoURL} alt={getContactDisplayName(viewingContact)} className="profile-avatar-big" style={{ objectFit:'cover' }} loading="lazy" />
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
              <div className={`profile-status-badge ${onlineUsers.has(viewingContact.uid) && !inactiveUsers.has(viewingContact.uid) ? 'online' : onlineUsers.has(viewingContact.uid) ? 'inactive' : 'offline'}`}>
                <span className="profile-status-dot" />
                {onlineUsers.has(viewingContact.uid) && !inactiveUsers.has(viewingContact.uid) ? 'Online' : onlineUsers.has(viewingContact.uid) ? 'Inactief' : 'Offline'}
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
          <div className="profile-modal-box" onClick={e => e.stopPropagation()}>

            {/* Header over volledige breedte */}
            <div className="profile-modal-header">
              <span className="profile-modal-header-title">Instellingen</span>
              <button className="profile-modal-close" onClick={() => setShowProfile(false)}>✕</button>
            </div>

            {/* Sidebar + Content (flex row) */}
            <div className="profile-modal-body">

            {/* Sidebar */}
            <div className="profile-sidebar">
              {[
                ['account',    <User size={16} />,           'Mijn account'],
                ['styling',    <Palette size={16} />,        'Styling'],
                ['verwijderen',<Delete size={16} />,         'Verwijderen'],
              ].map(([id, icon, label]) => (
                <button key={id} className={`profile-sidebar-tab${profileTab === id ? ' active' : ''}${id === 'verwijderen' ? ' danger' : ''}`}
                  onClick={() => setProfileTab(id)}>
                  {icon}<span>{label}</span>
                </button>
              ))}
            </div>

            {/* Inhoud */}
            <div className="profile-content">

              {/* ── TAB: MIJN ACCOUNT ── */}
              {profileTab === 'account' && (
                <div>
                  {/* Profielfoto */}
                  <div style={{ display:'flex', justifyContent:'center', marginBottom:'24px' }}>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
                      <div className="profile-photo-wrap" onClick={() => photoInputRef.current?.click()}>
                        {photoPreview
                          ? <img src={photoPreview} alt="avatar" className="profile-avatar-big" style={{ objectFit:'cover' }} loading="lazy" />
                          : <div className="profile-avatar-big">{getInitials(user.displayName || user.email)}</div>
                        }
                        <div className="profile-photo-overlay"><Camera size={16} /></div>
                      </div>
                      <button type="button" onClick={() => setShowAvatarBuilder(true)}
                        style={{ padding:'7px 16px', borderRadius:10, border:'1px solid rgba(108,99,255,0.4)', background:'rgba(108,99,255,0.1)', color:'var(--accent)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                        🎨 Avatar maken
                      </button>
                    </div>
                    <input ref={photoInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handlePhotoChange} />
                  </div>

                  {/* Weergavenaam */}
                  <div className="form-group">
                    <label className="form-label">Weergavenaam</label>
                    <input className="form-input" placeholder="Jouw naam" value={newName} onChange={e => setNewName(e.target.value)} />
                  </div>

                  {/* Gebruikersnaam */}
                  <div className="form-group" style={{ borderTop:'1px solid var(--border)', paddingTop:'16px' }}>
                    <label className="form-label">Gebruikersnaam</label>
                    <input className="form-input" placeholder="jouw_naam" value={newUsername}
                      onChange={e => setNewUsername(e.target.value)} autoCapitalize="none" autoCorrect="off" />
                    <div style={{ fontSize:'11px', color:'var(--text3)', marginTop:'4px' }}>3–20 tekens · letters, cijfers en _</div>
                  </div>

                  {/* E-mail (alleen ouders) */}
                  {isParent && (
                    <div className="form-group" style={{ borderTop:'1px solid var(--border)', paddingTop:'16px' }}>
                      <label className="form-label">E-mailadres</label>
                      <input className="form-input" type="email" value={user.email} disabled style={{ opacity:.5 }} />
                    </div>
                  )}

                  {/* Wachtwoord wijzigen — niet voor kindaccounts */}
                  {!user.email?.endsWith('@pulse.internal') && <div style={{ borderTop:'1px solid var(--border)', paddingTop:'16px' }}>
                    <label className="form-label" style={{ marginBottom:'10px', display:'block' }}>Wachtwoord wijzigen</label>
                    <div className="form-group">
                      <div style={{ position:'relative' }}>
                        <input className="form-input" type={showNewPassword ? 'text' : 'password'}
                          placeholder="Nieuw wachtwoord" aria-label="Nieuw wachtwoord" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                          style={{ paddingRight:'42px' }} />
                        <button type="button" aria-label={showNewPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'} onClick={() => setShowNewPassword(p => !p)}
                          style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text3)', padding:0 }}>
                          {showNewPassword ? <EyeOff size={18}/> : <EyeOn size={18}/>}
                        </button>
                      </div>
                    </div>
                    <div className="form-group">
                      <input className="form-input" type={showNewPassword ? 'text' : 'password'}
                        placeholder="Bevestig wachtwoord" aria-label="Bevestig wachtwoord" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                    </div>
                    <button type="button" className="btn-secondary" style={{ width:'100%' }}
                      disabled={passwordLoading || !newPassword} onClick={changePassword}>
                      {passwordLoading ? 'Bezig…' : 'Wachtwoord wijzigen'}
                    </button>
                    {passwordMsg && <div style={{ fontSize:'12px', marginTop:'6px', color: passwordMsg.startsWith('Fout') ? 'var(--danger)' : 'var(--success)' }}>{passwordMsg}</div>}
                  </div>}

                  {/* Opslaan onderaan */}
                  <div style={{ borderTop:'1px solid var(--border)', paddingTop:'16px', marginTop:'8px' }}>
                    {profileMsg && <div style={{ fontSize:'12px', marginBottom:'10px', color: profileMsg.startsWith('Fout') ? 'var(--danger)' : 'var(--success)' }}>{profileMsg}</div>}
                    {usernameMsg && <div style={{ fontSize:'12px', marginBottom:'10px', color: usernameMsg.startsWith('Fout') ? 'var(--danger)' : 'var(--success)' }}>{usernameMsg}</div>}
                    <button type="button" className="btn-primary" style={{ width:'100%' }}
                      disabled={profileLoading || usernameLoading}
                      onClick={async () => { await saveProfile(); if (newUsername.trim()) await saveUsername(); }}>
                      {(profileLoading || usernameLoading) ? 'Opslaan…' : 'Opslaan →'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── TAB: ACCOUNT VERWIJDEREN ── */}
              {profileTab === 'verwijderen' && (
                <div>
                  <div style={{ marginBottom:'20px' }}>
                    <h4 style={{ fontFamily:"'Syne',sans-serif", fontSize:'18px', fontWeight:800, color:'var(--danger)', marginBottom:'10px' }}>Account verwijderen</h4>
                    <p style={{ fontSize:'13px', color:'var(--text2)', lineHeight:1.6 }}>
                      Als je je account verwijdert worden <strong>al je chats, berichten en gegevens permanent verwijderd</strong>. Dit kan niet ongedaan worden gemaakt.
                    </p>
                  </div>
                  <div style={{ background:'rgba(255,71,87,.06)', border:'1px solid rgba(255,71,87,.2)', borderRadius:'14px', padding:'16px', marginBottom:'20px' }}>
                    <div style={{ fontSize:'13px', color:'var(--text2)', display:'flex', flexDirection:'column', gap:'6px' }}>
                      <div>🗑️ Alle berichten worden verwijderd</div>
                      <div>👥 Je wordt uit alle gesprekken verwijderd</div>
                      <div>🔐 Je account wordt permanent afgesloten</div>
                    </div>
                  </div>
                  <button className="btn-danger" style={{ width:'100%' }}
                    onClick={() => { setShowProfile(false); handleDeleteAccount(); }}>
                    <Delete size={16} style={{ marginRight:6 }} /> Account definitief verwijderen
                  </button>
                </div>
              )}

              {/* ── TAB: STYLING ── */}
              {profileTab === 'styling' && (
                <div>
                  <div style={{ marginBottom:'16px' }}>
                    <label className="form-label" style={{ marginBottom:'12px', display:'block' }}>Chat achtergrond</label>

                    {/* Achtergrond tabs */}
                    <div style={{ display:'flex', background:'var(--surface2)', borderRadius:'10px', padding:'4px', gap:'4px', marginBottom:'14px' }}>
                      {[
                        ['foto',      <ImageIcon size={14} />,      'Foto'],
                        ['kleur',     <ColorCircle size={14} />,    'Kleur'],
                        ['standaard', <LayoutTemplate size={14} />, 'Standaard'],
                      ].map(([id, icon, label]) => (
                        <button key={id} type="button" onClick={() => { setChatBgTab(id); setChatBgMsg(''); }}
                          style={{ flex:1, padding:'7px 4px', border:'none', borderRadius:'7px', fontSize:'12px', fontWeight:600, cursor:'pointer', transition:'all .15s', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px',
                            background: chatBgTab === id ? 'linear-gradient(135deg,#7c6fff,#a855f7)' : 'transparent',
                            color: chatBgTab === id ? '#fff' : 'var(--text2)' }}>
                          {icon}{label}
                        </button>
                      ))}
                    </div>

                    {/* Voorvertoning */}
                    <div style={{ borderRadius:'12px', overflow:'hidden', marginBottom:'14px', height:'110px', position:'relative',
                      background: chatBg?.type === 'photo' ? `url(${chatBg.url}) center/cover` : chatBg?.type === 'color' ? chatBg.value : 'var(--bg)',
                      border:'1px solid var(--border)' }}>
                      {chatBg?.type === 'photo' && <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.15)' }} />}
                      <div style={{ position:'absolute', bottom:'8px', left:'10px' }}>
                        <div style={{ background: chatBg ? 'rgba(26,26,36,0.85)' : 'var(--surface2)', border:'1px solid rgba(255,255,255,.12)', borderRadius:'12px 12px 12px 3px', padding:'6px 12px', fontSize:'12px', color:'#fff', backdropFilter:'blur(6px)' }}>Hallo! 👋</div>
                      </div>
                      <div style={{ position:'absolute', bottom:'8px', right:'10px' }}>
                        <div style={{ background:'linear-gradient(135deg,#7c6fff,#a855f7)', borderRadius:'12px 12px 3px 12px', padding:'6px 12px', fontSize:'12px', color:'#fff' }}>Hey!</div>
                      </div>
                    </div>

                    {/* Foto tab */}
                    {chatBgTab === 'foto' && (
                      <div>
                        {chatBg?.type === 'photo' && <div style={{ fontSize:'12px', color:'var(--success)', marginBottom:'8px' }}>✓ Foto achtergrond actief</div>}
                        <button type="button" className="btn-secondary" style={{ width:'100%' }} disabled={chatBgLoading}
                          onClick={() => bgInputRef.current?.click()}>
                          {chatBgLoading ? 'Uploaden…' : chatBg?.type === 'photo' ? 'Andere foto kiezen' : 'Foto kiezen'}
                        </button>
                        <div style={{ fontSize:'11px', color:'var(--text3)', marginTop:'6px', textAlign:'center' }}>JPG, PNG of WEBP · max 5 MB</div>
                        <input ref={bgInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" style={{ display:'none' }}
                          onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (f) uploadChatBgPhoto(f); }} />
                      </div>
                    )}

                    {/* Kleur tab */}
                    {chatBgTab === 'kleur' && (
                      <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', justifyContent:'center' }}>
                        {['#1e0a3c','#051236','#0a1f0e','#1f0a10','#0f1923','#1a1206','#000000','#1c1a18'].map(color => (
                          <button key={color} type="button" disabled={chatBgLoading} onClick={() => saveChatBgColor(color)}
                            style={{ width:'36px', height:'36px', borderRadius:'50%', background:color,
                              border: chatBg?.type==='color' && chatBg.value===color ? '3px solid var(--accent)' : '2px solid var(--border)',
                              cursor:'pointer', position:'relative', transition:'all .15s',
                              boxShadow: chatBg?.type==='color' && chatBg.value===color ? '0 0 0 2px var(--bg),0 0 0 4px var(--accent)' : 'none' }}>
                            {chatBg?.type === 'color' && chatBg.value === color && (
                              <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'14px' }}>✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Standaard tab */}
                    {chatBgTab === 'standaard' && (
                      chatBg
                        ? <button type="button" className="btn-secondary" style={{ width:'100%' }} disabled={chatBgLoading} onClick={removeChatBg}>
                            {chatBgLoading ? 'Bezig…' : 'Standaard achtergrond herstellen'}
                          </button>
                        : <div style={{ textAlign:'center', color:'var(--text3)', fontSize:'13px', padding:'8px 0' }}>Standaard achtergrond is actief</div>
                    )}

                    {chatBgMsg && <div style={{ marginTop:'8px', fontSize:'12px', color: chatBgMsg.startsWith('Fout') ? 'var(--danger)' : 'var(--success)' }}>{chatBgMsg}</div>}
                  </div>
                </div>
              )}

            </div>{/* /profile-content */}
            </div>{/* /profile-modal-body */}
          </div>
        </div>
      )}

      {/* ── CONTACTPROFIEL MODAL ── */}
      {showContactProfile && activeConv && !activeConv.isGroup && (() => {
        const uid       = getOtherUid(activeConv);
        const name      = getConvName(activeConv);
        const email     = activeConv.memberEmails?.[uid] || contacts.find(c => c.uid === uid)?.email || '';
        const photo     = getConvPhoto(activeConv);
        const isOnline   = uid && onlineUsers.has(uid);
        const isInactive = uid && inactiveUsers.has(uid);
        return (
          <div className="modal-overlay" onClick={() => setShowContactProfile(false)}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                <h3 className="modal-title" style={{ margin:0 }}><User size={18} /> Profiel</h3>
                <button className="icon-btn" onClick={() => { const c = contacts.find(c => c.uid === uid); if (c) { setSharingContact(c); setShowContactProfile(false); } }} title="Contactpersoon delen"><Share size={18} /></button>
              </div>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:'20px' }}>
                {photo
                  ? <img src={photo} alt={name || 'Profielfoto'} className="profile-avatar-big" style={{ objectFit:'cover' }} loading="lazy" />
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
                <div className={`profile-status-badge ${isOnline && !isInactive ? 'online' : isOnline && isInactive ? 'inactive' : 'offline'}`}>
                  <span className="profile-status-dot" />
                  {isOnline && !isInactive ? 'Online' : isOnline && isInactive ? 'Inactief' : 'Offline'}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Relatie</label>
                <div style={{ display:'flex', gap:8 }}>
                  {['familie', 'vrienden'].map(lbl => (
                    <button key={lbl} onClick={() => setConvLabel(activeConv.id, convLabels[activeConv.id] === lbl ? null : lbl)}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:20, border:`1.5px solid ${convLabels[activeConv.id] === lbl ? '#6c63ff' : 'var(--border)'}`, background: convLabels[activeConv.id] === lbl ? '#6c63ff' : 'transparent', color: convLabels[activeConv.id] === lbl ? '#fff' : 'var(--text2)', fontSize:13, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
                      {lbl === 'familie' ? <><Heart size={15} /> Familie</> : <><Users size={15} /> Vrienden</>}
                    </button>
                  ))}
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

            {(() => {
              const isAdmin = activeConv.creatorId === user.uid;
              return (
                <>
                  <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'16px' }}>
                    {activeConv.members.map(memberId => {
                      const name      = activeConv.memberNames?.[memberId] || memberId;
                      const isMe      = memberId === user.uid;
                      const isOnline  = onlineUsers.has(memberId);
                      const isCreator = memberId === activeConv.creatorId;
                      const photo     = contacts.find(c => c.uid === memberId)?.photoURL || null;
                      return (
                        <div key={memberId} className="search-result" style={{ cursor:'default' }}>
                          <div className="avatar-wrap">
                            <UserAvatar photoURL={photo} displayName={name} className="sm" />
                            {isOnline && <span className="online-dot sm" />}
                          </div>
                          <div style={{ flex:1 }}>
                            <div className="conv-name" style={{ display:'flex', alignItems:'center', gap:6 }}>
                              {name}{isMe ? ' (jij)' : ''}
                              {isCreator && <span className="admin-badge"><AdminIcon size={11} /> Beheerder</span>}
                            </div>
                            <div className="conv-preview" style={isOnline ? { color:'var(--success)' } : {}}>
                              {isOnline ? 'Online' : 'Offline'}
                            </div>
                          </div>
                          {!isMe && isAdmin && (
                            <button className="icon-btn" title="Verwijderen uit groep"
                              onClick={() => removeMemberFromGroup(memberId)}
                              style={{ color:'var(--danger)', flexShrink:0 }}><Delete size={18} /></button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {isAdmin && !addingMember ? (
                    <button className="btn-secondary" onClick={() => setAddingMember(true)}>+ Lid toevoegen</button>
                  ) : isAdmin && addingMember ? (
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
                </> ) : null}
                </>
              );
            })()}

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

      {/* ── DOORSTUREN MODAL ── */}
      {forwardMsg && (
        <div className="modal-overlay" onClick={() => setForwardMsg(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:380 }}>
            <h3 className="modal-title">↪️ Doorsturen naar…</h3>
            <div style={{ fontSize:13, color:'var(--text3)', marginBottom:12, padding:'8px 12px', background:'var(--surface2)', borderRadius:8, maxHeight:60, overflow:'hidden', textOverflow:'ellipsis' }}>
              {forwardMsg.text}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:320, overflowY:'auto' }}>
              {conversations.filter(c => c.id !== activeConv?.id).map(conv => (
                <button key={conv.id} onClick={() => forwardToConv(conv)} style={{
                  display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
                  background:'var(--surface2)', border:'1px solid var(--border)',
                  borderRadius:10, cursor:'pointer', textAlign:'left', color:'var(--text)',
                }}>
                  <div className="avatar-circle sm">{getInitials(getConvName(conv))}</div>
                  <span style={{ fontSize:14, fontWeight:500 }}>{getConvName(conv)}</span>
                </button>
              ))}
            </div>
            <div className="modal-actions" style={{ marginTop:12 }}>
              <button className="btn-secondary" onClick={() => setForwardMsg(null)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ERROR / INFO TOAST ── */}
      {errToast && (
        <div className="mention-toast" style={{ background: errToast.startsWith('📋') ? 'rgba(34,197,94,0.92)' : 'rgba(255,71,87,0.92)' }}>
          <span>{errToast}</span>
        </div>
      )}

      {/* ── MENTION TOAST ── */}
      {mentionToast && (
        <div className="mention-toast">
          <span className="mention-toast-icon">@</span>
          <span><strong>{mentionToast.senderName}</strong> heeft je vermeld in <strong>{mentionToast.groupName}</strong></span>
        </div>
      )}

      {/* ── ACCOUNT GEPAUZEERD OVERLAY ── */}
      {/* ── OUDER ACTIVITEIT TOAST ── */}
      {parentToast && (
        <div className="parent-toast">
          <span style={{ fontSize:18 }}>❤️</span>
          <span>{parentToast.description}</span>
        </div>
      )}

      {/* ── AVATAR BUILDER ── */}
      {showAvatarBuilder && (
        <AvatarBuilder
          uid={user.uid}
          currentOptions={avatarOptions}
          currentPhotoURL={photoPreview}
          darkMode={!lightMode}
          onClose={() => setShowAvatarBuilder(false)}
          onSave={(photoURL, opts) => {
            setAvatarOptions(opts);
            setPhotoPreview(photoURL);
            localStorage.setItem(`pulse_photo_${user.uid}`, photoURL);
            setShowAvatarBuilder(false);
            setProfileMsg('Avatar opgeslagen!');
            setUsernameMsg('');
          }}
        />
      )}


    </div>
  );
}
