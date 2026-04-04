// src/hooks/useContacts.js
import { useState, useCallback } from 'react';
import { db } from '../firebase';
import { doc, getDoc, getDocs, collection, setDoc } from 'firebase/firestore';
import { getSocket, BACKEND_URL } from '../services/socket';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

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
  const authFetch = useCallback(async (url, options = {}) => {
    const token = await user.getIdToken();
    return fetch(url, { ...options, headers: { ...(options.headers || {}), 'Authorization': `Bearer ${token}` } });
  }, [user]);

  async function resolveIdentifierToEmail(identifier) {
    const clean = identifier.trim().toLowerCase();
    if (!clean) return { ok: false, error: 'Voer een e-mailadres of gebruikersnaam in.' };
    if (EMAIL_RE.test(clean)) return { ok: true, email: clean, identifier: clean };
    if (!USERNAME_RE.test(clean)) {
      return { ok: false, error: 'Gebruik een geldig e-mailadres of gebruikersnaam.' };
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/users/lookup-username?username=${encodeURIComponent(clean)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || 'Gebruikersnaam niet gevonden.' };
      return { ok: true, email: data.email || `${clean}@pulse.internal`, identifier: clean };
    } catch {
      return { ok: false, error: 'Gebruikersnaam kon niet worden gecontroleerd.' };
    }
  }

  // ── State ─────────────────────────────────────────────────────────────────
  const [contacts,        setContacts]        = useState([]);
  const [pinnedContacts,  setPinnedContacts]  = useState(() => {
    try { return JSON.parse(localStorage.getItem(`pulse_pinned_${user.uid}`) || '[]'); } catch { return []; }
  });
  const [friendRequests,  setFriendRequests]  = useState([]);
  const [sentFriendRequests, setSentFriendRequests] = useState([]);
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
  const [pendingFriendRequest, setPendingFriendRequest] = useState(null);
  const [showFriendRequestsPanel, setShowFriendRequestsPanel] = useState(false);

  // Blocked contacts
  const [blockedContacts,   setBlockedContacts]   = useState([]);
  const [parentBlockedUids, setParentBlockedUids] = useState([]);
  const [blockingContact,   setBlockingContact]   = useState(null); // { uid, displayName } — bevestigingsmodal

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

  async function saveContactNickname(contactUid, name) {
    const trimmed = name.trim();
    // localStorage (snelle lokale cache)
    if (trimmed) {
      localStorage.setItem(`pulse_nick_${contactUid}`, trimmed);
      setNicknameCache(prev => ({ ...prev, [contactUid]: trimmed }));
    } else {
      localStorage.removeItem(`pulse_nick_${contactUid}`);
      setNicknameCache(prev => { const n = { ...prev }; delete n[contactUid]; return n; });
    }
    // Firestore (sync tussen apparaten)
    try {
      const nickRef = doc(db, 'users', user.uid, 'nicknames', contactUid);
      await setDoc(nickRef, { nickname: trimmed || null, updatedAt: new Date().toISOString() });
    } catch (e) { console.warn('[Pulse] Nickname opslaan in Firestore mislukt:', e.message); }
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
      const [contactsSnap, nicknamesSnap] = await Promise.all([
        getDocs(collection(db, 'users', user.uid, 'contacts')),
        getDocs(collection(db, 'users', user.uid, 'nicknames')),
      ]);
      const raw = contactsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Laad nicknames uit Firestore en sync naar localStorage
      const firestoreNicknames = {};
      nicknamesSnap.docs.forEach(d => {
        const nick = d.data().nickname;
        if (nick) {
          firestoreNicknames[d.id] = nick;
          localStorage.setItem(`pulse_nick_${d.id}`, nick);
        } else {
          localStorage.removeItem(`pulse_nick_${d.id}`);
        }
      });
      if (Object.keys(firestoreNicknames).length > 0) {
        setNicknameCache(prev => ({ ...prev, ...firestoreNicknames }));
      }

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

  const loadBlockedContacts = useCallback(async () => {
    try {
      const res  = await authFetch(`${BACKEND_URL}/api/users/${user.uid}/blocked`);
      const data = await res.json();
      const contacts        = Array.isArray(data) ? data : (data?.contacts || []);
      const parentUids      = data?.parentBlockedUids || [];
      setBlockedContacts(contacts);
      setParentBlockedUids(parentUids);
    } catch (e) { console.warn('[Pulse] Fout:', e.message); }
  }, [authFetch, user.uid]);

  const loadFriendRequests = useCallback(async () => {
    try {
      const [incomingRes, sentRes] = await Promise.all([
        authFetch(`${BACKEND_URL}/api/friend-requests/${user.uid}`),
        authFetch(`${BACKEND_URL}/api/friend-requests/${user.uid}/sent`),
      ]);
      const incomingData = await incomingRes.json().catch(() => []);
      const sentData = await sentRes.json().catch(() => []);
      setFriendRequests(Array.isArray(incomingData) ? incomingData : []);
      setSentFriendRequests(Array.isArray(sentData) ? sentData : []);
    } catch (e) { console.warn('[Pulse] Fout:', e.message); }
  }, [authFetch, user.uid]);

  // ── Contact toevoegen ─────────────────────────────────────────────────────
  async function addContact() {
    setContactErr(''); setContactLoading(true);
    try {
      const resolved = await resolveIdentifierToEmail(contactEmail);
      if (!resolved.ok) { setContactErr(resolved.error); return; }
      const res  = await authFetch(`${BACKEND_URL}/api/friend-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUid: user.uid, fromName: user.displayName || user.email,
          fromEmail: user.email, fromPhoto: user.photoURL || null,
          toEmail: resolved.email,
          toIdentifier: resolved.identifier,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'friend_request_already_pending') {
          setPendingFriendRequest({
            requestId: data.requestId,
            toUid: data.toUid,
            reminderCount: Number(data.reminderCount || 0),
            remindersRemaining: Number(data.remindersRemaining || 0),
            canSendReminder: !!data.canSendReminder,
            canCancel: !!data.canCancel,
          });
        } else {
          setPendingFriendRequest(null);
        }
        setContactErr(data.error || 'Fout bij verzenden');
        return;
      }
      setPendingFriendRequest(null);
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
        await loadFriendRequests();
        setContactSuccess('Uitnodiging verzonden!');
      }
      setTimeout(() => setContactSuccess(''), 4000);
    } catch { setContactErr('Verbindingsfout'); }
    finally { setContactLoading(false); }
  }

  async function remindPendingFriendRequest(requestOverride = null) {
    const targetRequest = requestOverride || pendingFriendRequest;
    if (!targetRequest?.requestId || !targetRequest?.canSendReminder) return;

    setContactLoading(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/friend-requests/${targetRequest.requestId}/remind`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setContactErr(data.error || 'Herinnering sturen mislukt');
        if (data.requestId) {
          setPendingFriendRequest({
            requestId: data.requestId,
            toUid: data.toUid || pendingFriendRequest.toUid,
            reminderCount: Number(data.reminderCount || pendingFriendRequest.reminderCount || 0),
            remindersRemaining: Number(data.remindersRemaining || pendingFriendRequest.remindersRemaining || 0),
            canSendReminder: !!data.canSendReminder,
            canCancel: data.canCancel !== false,
          });
        }
        return;
      }

      setPendingFriendRequest({
        requestId: targetRequest.requestId,
        toUid: targetRequest.toUid,
        reminderCount: Number(data.reminderCount || 0),
        remindersRemaining: Number(data.remindersRemaining || 0),
        canSendReminder: !!data.canSendReminder,
        canCancel: true,
      });
      setSentFriendRequests(prev => prev.map(req =>
        req.id === targetRequest.requestId
          ? {
              ...req,
              reminderCount: Number(data.reminderCount || 0),
              lastReminderAt: data.remindedAt || req.lastReminderAt || null,
            }
          : req
      ));
      setContactErr('Verzoek al verzonden');
      setContactSuccess('Herinnering verstuurd!');
      setTimeout(() => setContactSuccess(''), 4000);
    } catch {
      setContactErr('Herinnering sturen mislukt');
    } finally {
      setContactLoading(false);
    }
  }

  async function cancelPendingFriendRequest(requestOverride = null) {
    const targetRequest = requestOverride || pendingFriendRequest;
    if (!targetRequest?.requestId) return;

    setContactLoading(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/friend-requests/${targetRequest.requestId}/cancel`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setContactErr(data.error || 'Verzoek annuleren mislukt');
        return;
      }

      setPendingFriendRequest(null);
      setSentFriendRequests(prev => prev.filter(req => req.id !== targetRequest.requestId));
      setContactErr('');
      setContactSuccess('Uitnodiging geannuleerd.');
      setTimeout(() => setContactSuccess(''), 4000);
    } catch {
      setContactErr('Verzoek annuleren mislukt');
    } finally {
      setContactLoading(false);
    }
  }

  function clearPendingFriendRequestState() {
    setPendingFriendRequest(null);
  }

  async function remindFriendRequestById(requestId) {
    const request = sentFriendRequests.find((item) => item.id === requestId);
    if (!request) return;

    const targetRequest = {
      requestId: request.id,
      toUid: request.toUid,
      reminderCount: Number(request.reminderCount || 0),
      remindersRemaining: Math.max(0, 3 - Number(request.reminderCount || 0)),
      canSendReminder: Number(request.reminderCount || 0) < 3,
      canCancel: true,
    };
    setPendingFriendRequest(targetRequest);
    await remindPendingFriendRequest(targetRequest);
  }

  async function cancelFriendRequestById(requestId) {
    const request = sentFriendRequests.find((item) => item.id === requestId);
    if (!request) return;

    const targetRequest = {
      requestId: request.id,
      toUid: request.toUid,
      reminderCount: Number(request.reminderCount || 0),
      remindersRemaining: Math.max(0, 3 - Number(request.reminderCount || 0)),
      canSendReminder: Number(request.reminderCount || 0) < 3,
      canCancel: true,
    };
    setPendingFriendRequest(targetRequest);
    await cancelPendingFriendRequest(targetRequest);
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
      const res = await authFetch(`${BACKEND_URL}/api/friend-requests/${requestId}/accept`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showErrToast(data.error || 'Kan verzoek niet accepteren.');
        setFriendRequests(prev => prev.filter(r => r.id !== requestId));
        return;
      }
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

  function removeContact(targetUid) {
    setConfirmDialog({
      message: 'Weet je zeker dat je dit contact wilt verwijderen?',
      onConfirm: async () => {
        // Eenzijdige verwijdering via backend — alleen eigen kant wordt verwijderd.
        // De ander behoudt het contact en mag nog berichten sturen.
        try {
          await authFetch(`${BACKEND_URL}/api/contacts/${user.uid}/${targetUid}`, { method: 'DELETE' });
        } catch (e) { console.warn('[Pulse] Contact verwijderen mislukt:', e.message); }
        setContacts(prev => prev.filter(c => c.uid !== targetUid));
        const conv = conversations.find(c => !c.isGroup && c.members?.includes(targetUid));
        if (conv) {
          setConversations(prev => prev.filter(c => c.id !== conv.id));
          if (activeConv?.id === conv.id) { setActiveConv(null); setMessages([]); }
        }
      },
    });
  }

  async function blockContact(targetUid) {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/users/${user.uid}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUid }),
      });
      if (res.ok) {
        const contact = contacts.find(c => c.uid === targetUid);
        if (contact) setBlockedContacts(prev => [...prev.filter(c => c.uid !== targetUid), contact]);
        setBlockingContact(null);
      }
    } catch (e) { console.warn('[Pulse] Fout:', e.message); }
  }

  async function unblockContact(targetUid) {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/users/${user.uid}/unblock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUid }),
      });
      if (res.ok) setBlockedContacts(prev => prev.filter(c => c.uid !== targetUid));
    } catch (e) { console.warn('[Pulse] Fout:', e.message); }
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
    const resolved = await resolveIdentifierToEmail(searchEmail);
    if (!resolved.ok) { setSearchErr(resolved.error); return; }
    try {
      const res  = await authFetch(`${BACKEND_URL}/api/users/search?q=${encodeURIComponent(resolved.identifier)}&email=${encodeURIComponent(resolved.email)}`);
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
    pendingFriendRequest, setPendingFriendRequest,
    sentFriendRequests, setSentFriendRequests,
    showFriendRequestsPanel, setShowFriendRequestsPanel,
    renamingContact, setRenamingContact,
    sharingContact, setSharingContact,
    shareRecipients, setShareRecipients,
    viewingSharedContact, setViewingSharedContact,
    viewingContact, setViewingContact,
    renameValue, setRenameValue,
    // loaders
    loadContacts, loadFriendRequests, loadBlockedContacts,
    // blocked
    blockedContacts, setBlockedContacts,
    parentBlockedUids, setParentBlockedUids,
    blockingContact, setBlockingContact,
    blockContact, unblockContact,
    // helpers
    getContactNickname, saveContactNickname, getContactDisplayName, findConvWithUid,
    // actions
    addContact, sendFriendRequestToEmail,
    remindPendingFriendRequest, cancelPendingFriendRequest,
    remindFriendRequestById, cancelFriendRequestById,
    acceptFriendRequest, declineFriendRequest,
    removeContact, togglePin,
    startChatWithContact, searchUser, startConversationWith,
    clearPendingFriendRequestState,
  };
}
