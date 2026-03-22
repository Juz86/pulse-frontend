// src/hooks/useContacts.js
import { useState, useCallback } from 'react';
import { db } from '../firebase';
import { doc, getDoc, getDocs, deleteDoc, collection } from 'firebase/firestore';
import { getSocket, BACKEND_URL } from '../services/socket';

export default function useContacts({
  user,
  conversations,
  setConversations,
  activeConv,
  setActiveConv,
  setMessages,
  setConvLabels,
  openConversation,
  loadConversations,
  showErrToast,
  setConfirmDialog,
}) {
  async function authFetch(url, options = {}) {
    const token = await user.getIdToken();
    return fetch(url, { ...options, headers: { ...(options.headers || {}), 'Authorization': `Bearer ${token}` } });
  }

  // ── State ─────────────────────────────────────────────────────────────────
  const [contacts,        setContacts]        = useState([]);
  const [pinnedContacts,  setPinnedContacts]  = useState(() => {
    try { return JSON.parse(localStorage.getItem(`pulse_pinned_${user.uid}`) || '[]'); } catch { return []; }
  });
  const [friendRequests,  setFriendRequests]  = useState([]);
  const [contactSuccess,  setContactSuccess]  = useState('');
  const [showAddContact,  setShowAddContact]  = useState(false);
  const [contactEmail,    setContactEmail]    = useState('');
  const [contactNickname, setContactNickname] = useState('');
  const [contactRelation, setContactRelation] = useState(null);
  const [contactErr,      setContactErr]      = useState('');
  const [contactLoading,  setContactLoading]  = useState(false);
  const [showNewChat,     setShowNewChat]     = useState(false);
  const [searchEmail,     setSearchEmail]     = useState('');
  const [searchResult,    setSearchResult]    = useState(null);
  const [searchErr,       setSearchErr]       = useState('');
  const [friendReqSent,   setFriendReqSent]   = useState(false);
  const [friendReqLoading, setFriendReqLoading] = useState(false);

  // Contact rename / share / view
  const [renamingContact,      setRenamingContact]      = useState(null);
  const [sharingContact,       setSharingContact]       = useState(null);
  const [shareRecipients,      setShareRecipients]      = useState([]);
  const [viewingSharedContact, setViewingSharedContact] = useState(null);
  const [viewingContact,       setViewingContact]       = useState(null);
  const [renameValue,          setRenameValue]          = useState('');

  // Nickname cache
  const [nicknameCache, setNicknameCache] = useState(() => {
    const cache = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith('pulse_nick_')) cache[k.replace('pulse_nick_', '')] = localStorage.getItem(k);
      }
    } catch (e) { console.warn('[Pulse] Fout:', e.message); }
    return cache;
  });

  // ── Nickname helpers ──────────────────────────────────────────────────────
  function getContactNickname(uid) { return nicknameCache[uid] || null; }

  function saveContactNickname(uid, name) {
    if (name.trim()) {
      localStorage.setItem(`pulse_nick_${uid}`, name.trim());
      setNicknameCache(prev => ({ ...prev, [uid]: name.trim() }));
    } else {
      localStorage.removeItem(`pulse_nick_${uid}`);
      setNicknameCache(prev => { const n = { ...prev }; delete n[uid]; return n; });
    }
  }

  function getContactDisplayName(contact) {
    return nicknameCache[contact.uid] || contact.displayName;
  }

  // ── Conversation helpers ──────────────────────────────────────────────────
  function findConvWithUid(uid) {
    return conversations.find(conv => !conv.isGroup && conv.members?.includes(uid) && conv.members?.includes(user.uid));
  }

  // ── Data laden ───────────────────────────────────────────────────────────
  const loadContacts = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'contacts'));
      const raw  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const needsPhoto = raw.filter(c => !c.photoURL);
      const photoMap   = {};
      if (needsPhoto.length > 0) {
        const docs = await Promise.all(needsPhoto.map(c => getDoc(doc(db, 'users', c.uid))));
        docs.forEach((d, i) => {
          if (d.exists() && d.data().photoURL) photoMap[needsPhoto[i].uid] = d.data().photoURL;
        });
      }
      setContacts(raw.map(c => ({ ...c, photoURL: c.photoURL || photoMap[c.uid] || null })));
    } catch (e) { console.warn('[Pulse] Fout:', e.message); }
  }, [user.uid]);

  const loadFriendRequests = useCallback(async () => {
    try {
      const res  = await authFetch(`${BACKEND_URL}/api/friend-requests/${user.uid}`);
      const data = await res.json();
      setFriendRequests(Array.isArray(data) ? data : []);
    } catch (e) { console.warn('[Pulse] Fout:', e.message); }
  }, [user.uid]);

  // ── Contact toevoegen ─────────────────────────────────────────────────────
  async function addContact() {
    setContactErr(''); setContactLoading(true);
    try {
      const res  = await authFetch(`${BACKEND_URL}/api/friend-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUid: user.uid, fromName: user.displayName || user.email,
          fromEmail: user.email, fromPhoto: user.photoURL || null,
          toEmail: contactEmail.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setContactErr(data.error || 'Fout bij verzenden'); return; }
      if (contactNickname.trim() && data.toUid) saveContactNickname(data.toUid, contactNickname.trim());
      if (contactRelation && data.toUid) {
        const pending = (() => { try { return JSON.parse(localStorage.getItem(`pulse_pending_labels_${user.uid}`) || '{}'); } catch { return {}; } })();
        pending[data.toUid] = contactRelation;
        localStorage.setItem(`pulse_pending_labels_${user.uid}`, JSON.stringify(pending));
      }
      setContactEmail(''); setContactNickname(''); setContactRelation(null);
      setShowAddContact(false);
      if (data.restored) {
        await loadContacts();
        setContactSuccess('Contact hersteld!');
      } else {
        setContactSuccess('Uitnodiging verzonden!');
      }
      setTimeout(() => setContactSuccess(''), 4000);
    } catch { setContactErr('Verbindingsfout'); }
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
    } catch (e) { console.warn('[Pulse] Fout:', e.message); }
    finally { setFriendReqLoading(false); }
  }

  async function acceptFriendRequest(requestId) {
    try {
      await authFetch(`${BACKEND_URL}/api/friend-requests/${requestId}/accept`, { method: 'POST' });
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
      loadContacts();
    } catch (e) { console.warn('[Pulse] Fout:', e.message); }
  }

  async function declineFriendRequest(requestId) {
    try {
      await authFetch(`${BACKEND_URL}/api/friend-requests/${requestId}/decline`, { method: 'POST' });
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (e) { console.warn('[Pulse] Fout:', e.message); }
  }

  function removeContact(uid) {
    setConfirmDialog({
      message: 'Weet je zeker dat je dit contact wilt verwijderen?',
      onConfirm: async () => {
        await deleteDoc(doc(db, 'users', user.uid, 'contacts', uid));
        setContacts(prev => prev.filter(c => c.uid !== uid));
        const conv = conversations.find(c => !c.isGroup && c.members?.includes(uid));
        if (conv) {
          try { await authFetch(`${BACKEND_URL}/api/conversations/${conv.id}`, { method: 'DELETE' }); } catch (e) { console.warn('[Pulse] Fout:', e.message); }
          setConversations(prev => prev.filter(c => c.id !== conv.id));
          if (activeConv?.id === conv.id) { setActiveConv(null); setMessages([]); }
        }
      },
    });
  }

  function togglePin(contactUid) {
    setPinnedContacts(prev => {
      const next = prev.includes(contactUid) ? prev.filter(id => id !== contactUid) : [...prev, contactUid];
      localStorage.setItem(`pulse_pinned_${user.uid}`, JSON.stringify(next));
      return next;
    });
  }

  function startChatWithContact(contact) {
    const existing = findConvWithUid(contact.uid);
    if (existing) { openConversation(existing); return; }
    const liveSocket = getSocket();
    if (!liveSocket?.connected) { showErrToast('Geen verbinding. Probeer opnieuw.'); return; }
    liveSocket.emit('conversation:create', {
      members:      [user.uid, contact.uid],
      memberNames:  { [user.uid]: user.displayName || user.email, [contact.uid]: contact.displayName },
      memberEmails: { [user.uid]: user.email, [contact.uid]: contact.email },
      isGroup: false,
    }, (res) => {
      if (!res || res.error) { showErrToast(res?.error || 'Gesprek kon niet worden aangemaakt'); return; }
      const conv = { id: res.convId, members: [user.uid, contact.uid], memberNames: { [user.uid]: user.displayName, [contact.uid]: contact.displayName }, memberEmails: { [user.uid]: user.email, [contact.uid]: contact.email }, isGroup: false };
      openConversation(conv);
      loadConversations();
    });
  }

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
    const existing = findConvWithUid(contact.uid);
    if (existing) { setShowNewChat(false); openConversation(existing); return; }
    const liveSocket = getSocket();
    if (!liveSocket?.connected) { showErrToast('Geen verbinding. Probeer opnieuw.'); return; }
    liveSocket.emit('conversation:create', {
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

  return {
    // state
    contacts, setContacts,
    pinnedContacts, setPinnedContacts,
    friendRequests, setFriendRequests,
    contactSuccess, setContactSuccess,
    showAddContact, setShowAddContact,
    contactEmail, setContactEmail,
    contactNickname, setContactNickname,
    contactRelation, setContactRelation,
    contactErr, contactLoading,
    showNewChat, setShowNewChat,
    searchEmail, setSearchEmail,
    searchResult, searchErr,
    friendReqSent, setFriendReqSent,
    friendReqLoading,
    renamingContact, setRenamingContact,
    sharingContact, setSharingContact,
    shareRecipients, setShareRecipients,
    viewingSharedContact, setViewingSharedContact,
    viewingContact, setViewingContact,
    renameValue, setRenameValue,
    // loaders
    loadContacts, loadFriendRequests,
    // helpers
    getContactNickname, saveContactNickname, getContactDisplayName, findConvWithUid,
    // actions
    addContact, sendFriendRequestToEmail,
    acceptFriendRequest, declineFriendRequest,
    removeContact, togglePin,
    startChatWithContact, searchUser, startConversationWith,
  };
}
