// src/screens/ParentDashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { getInitials, timeAgo, toMs } from '../utils';
import { UserCheck, UserPlus2, UserX, PauseCircle, KeyRound, Trash2, Block, Activity, Users, UserPlus, EyeOn, EyeOff, Message, Phone, Video, Refresh, ChevronDown, Check, Cancel, MagicEdit } from '../components/Icons';
import { BACKEND_URL as BACKEND } from '../services/socket';
import { db } from '../firebase';
import { ProfilePageShell } from '../components/ProfilePageShell';
import UserAvatar from '../components/UserAvatar';
import PulseConfirmSheet from '../components/PulseConfirmSheet';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTERNAL_ACCOUNT_EMAIL_RE = /@(kind\.pulse\.local|pulse\.internal)$/i;
const LOCATION_STALE_AFTER_MS = 2 * 60 * 1000;
const LOCATION_OLD_AFTER_MS = 15 * 60 * 1000;

function formatLocationLastSeen(updatedAtMs) {
  if (!updatedAtMs) return 'Nog niet gedeeld';
  const diffMs = Math.max(0, Date.now() - updatedAtMs);
  if (diffMs < 60_000) return 'Zojuist bijgewerkt';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} min geleden`;
  const date = new Date(updatedAtMs);
  return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

export default function ParentDashboard({
  user,
  onClose,
  panelRef = null,
  parentActivityBadge = 0,
  onActivitiesViewed,
  embeddedInSidebarCluster = false,
  embeddedPortalView = null,
  onEmbeddedPortalViewChange,
}) {
  const [portalViewState, setPortalViewState] = useState('menu');
  const [activeTab,      setActiveTab]      = useState('add');
  const [children,       setChildren]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [activities,     setActivities]     = useState([]);
  const [unreadActivityCount, setUnreadActivityCount] = useState(0);

  // Kindaccount aanmaken
  const [childName,      setChildName]      = useState('');
  const [childUsername,  setChildUsername]  = useState('');
  const [childPassword,  setChildPassword]  = useState('');
  const [createError,    setCreateError]    = useState('');
  const [createSuccess,  setCreateSuccess]  = useState('');
  const [createLoading,  setCreateLoading]  = useState(false);
  const [showCreatePw,   setShowCreatePw]   = useState(false);
  const [createUsernameStatus,  setCreateUsernameStatus]  = useState('');
  const [createUsernameLoading, setCreateUsernameLoading] = useState(false);

  // Wachtwoord wijzigen per kind
  const [changingPwUid,  setChangingPwUid]  = useState(null);
  const [newPassword,    setNewPassword]    = useState('');
  const [pwError,        setPwError]        = useState('');
  const [pwSuccess,      setPwSuccess]      = useState('');
  const [pwLoading,      setPwLoading]      = useState(false);
  const [showNewPw,      setShowNewPw]      = useState(false);
  const [editingUsernameUid, setEditingUsernameUid] = useState(null);
  const [editingUsername,    setEditingUsername]    = useState('');
  const [usernameError,      setUsernameError]      = useState('');
  const [usernameSuccess,    setUsernameSuccess]    = useState('');
  const [usernameSaving,     setUsernameSaving]     = useState(false);

  // Inline fouten voor pauzeren/hervatten/verwijderen
  const [childError,     setChildError]     = useState(''); // { uid, msg }

  // Inline editor en submenu voor pauzeren/hervatten
  const [pauseEditorUid, setPauseEditorUid] = useState(null);

  // Kind verwijderen
  const [confirmDelete,  setConfirmDelete]  = useState(null); // { uid, displayName }
  const [deleteError,    setDeleteError]    = useState('');

  // Co-ouder uitnodiging
  const [inviteModal,    setInviteModal]    = useState(null); // { uid, displayName }
  const [inviteEmail,    setInviteEmail]    = useState('');
  const [inviteLoading,  setInviteLoading]  = useState(false);
  const [inviteError,    setInviteError]    = useState('');
  const [inviteSuccess,  setInviteSuccess]  = useState('');
  const [inviteContacts, setInviteContacts] = useState([]);
  const [inviteContactSearch, setInviteContactSearch] = useState('');
  const [inviteContactsLoading, setInviteContactsLoading] = useState(false);

  // Co-ouder uitnodigingen ontvangen (Ouder B)
  const [coparentInvitations,    setCoparentInvitations]    = useState([]);
  const [invitationActionId,     setInvitationActionId]     = useState(null);
  const [invitationError,        setInvitationError]        = useState('');

  // Contacten tab
  const [contactsChildUid,    setContactsChildUid]    = useState(null);
  const [childContacts,       setChildContacts]       = useState([]);
  const [contactsLoading,     setContactsLoading]     = useState(false);
  const [contactsError,       setContactsError]       = useState('');
  const [contactActionUid,    setContactActionUid]    = useState(null); // uid bezig met actie

  // Analytics rapportage
  const [selectedChildUid, setSelectedChildUid] = useState(null);
  const [analytics,        setAnalytics]        = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError,   setAnalyticsError]   = useState('');
  const [activityContactFilter, setActivityContactFilter] = useState('all');
  const [childDropdownOpen, setChildDropdownOpen] = useState(false);
  const [locationByChildUid, setLocationByChildUid] = useState({});
  const [locationStreamReady, setLocationStreamReady] = useState(false);
  const [locationError, setLocationError] = useState('');

  const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

  const authFetch = useCallback(async (url, options = {}) => {
    const token = await user.getIdToken();
    return fetch(url, { ...options, headers: { ...(options.headers || {}), 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
  }, [user]);

  async function checkUsernameAvailability(username, excludeUsername = null) {
    const clean = username.trim().toLowerCase();
    if (!clean) return { ok: false, message: 'Gebruikersnaam is verplicht.' };
    if (!USERNAME_RE.test(clean)) {
      return { ok: false, message: 'Gebruik 3–20 tekens met alleen letters, cijfers en _.' };
    }
    if (excludeUsername && clean === excludeUsername.trim().toLowerCase()) {
      return { ok: true, clean };
    }
    const availabilityUrl = `${BACKEND}/api/users/check-username?username=${encodeURIComponent(clean)}`;
    const res = await fetch(availabilityUrl);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.available) return { ok: true, clean };
      return { ok: false, message: 'Deze gebruikersnaam is al in gebruik.' };
    }

    // Backward-compatible fallback for older live backends that only expose
    // lookup-username. In that shape, 404 means "available" and 200 means
    // "already taken".
    if (res.status === 404) {
      const lookupUrl = `${BACKEND}/api/users/lookup-username?username=${encodeURIComponent(clean)}`;
      const lookupRes = await fetch(lookupUrl);
      if (lookupRes.status === 404) {
        return { ok: true, clean };
      }
      if (lookupRes.ok) {
        return { ok: false, message: 'Deze gebruikersnaam is al in gebruik.' };
      }
    }

    const data = await res.json().catch(() => ({}));
    return { ok: false, message: data.error || 'Controleren van gebruikersnaam mislukt.' };
  }

  const loadChildren = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND}/api/parent/children`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setChildren(list);
      setSelectedChildUid(prev => list.some((child) => child.uid === prev) ? prev : (list[0]?.uid ?? null));
      setContactsChildUid(prev => prev || (list[0]?.uid ?? null));
    } catch (e) { console.warn('[Pulse] Fout:', e.message); }
    setLoading(false);
  }, [authFetch]);

  const loadChildContacts = useCallback(async (childUid) => {
    if (!childUid) return;
    setContactsLoading(true); setContactsError('');
    try {
      const res  = await authFetch(`${BACKEND}/api/parent/child/${childUid}/contacts`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ophalen mislukt.');
      setChildContacts(Array.isArray(data) ? data : []);
    } catch (err) { setContactsError(err.message); setChildContacts([]); }
    setContactsLoading(false);
  }, [authFetch]);

  const closeInviteModal = useCallback(() => {
    setInviteModal(null);
    setInviteEmail('');
    setInviteError('');
    setInviteSuccess('');
    setInviteContactSearch('');
    setInviteContacts([]);
  }, []);

  const loadInviteContacts = useCallback(async () => {
    setInviteContactsLoading(true);
    try {
      const res = await authFetch(`${BACKEND}/api/contacts/${user.uid}`);
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data.error || 'Contacten ophalen mislukt.');
      setInviteContacts(Array.isArray(data) ? data : []);
    } catch {
      setInviteContacts([]);
    } finally {
      setInviteContactsLoading(false);
    }
  }, [authFetch, user.uid]);

  async function parentBlockContact(childUid, targetUid) {
    setContactActionUid(targetUid);
    try {
      const res = await authFetch(`${BACKEND}/api/parent/child/${childUid}/block-contact`, {
        method: 'POST', body: JSON.stringify({ targetUid }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setChildContacts(prev => prev.map(c => c.uid === targetUid ? { ...c, isBlocked: true, isBlockedByParent: true } : c));
    } catch (err) { setContactsError(err.message); }
    setContactActionUid(null);
  }

  async function parentUnblockContact(childUid, targetUid) {
    setContactActionUid(targetUid);
    try {
      const res = await authFetch(`${BACKEND}/api/parent/child/${childUid}/unblock-contact`, {
        method: 'POST', body: JSON.stringify({ targetUid }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setChildContacts(prev => prev.map(c => c.uid === targetUid ? { ...c, isBlocked: false, isBlockedByParent: false } : c));
    } catch (err) { setContactsError(err.message); }
    setContactActionUid(null);
  }

  async function parentRemoveContact(childUid, targetUid) {
    setContactActionUid(targetUid);
    try {
      const res = await authFetch(`${BACKEND}/api/parent/child/${childUid}/remove-contact`, {
        method: 'POST', body: JSON.stringify({ targetUid }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setChildContacts(prev => prev.filter(c => c.uid !== targetUid));
    } catch (err) { setContactsError(err.message); }
    setContactActionUid(null);
  }

  const activitySeenStorageKey = `pulse_parent_activities_seen_${user.uid}`;

  const loadActivities = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND}/api/parent/activities`);
      const data = await res.json();
      const nextActivities = Array.isArray(data) ? data : [];
      const lastSeenAt = Number(localStorage.getItem(activitySeenStorageKey) || 0);
      setActivities(nextActivities);
      setUnreadActivityCount(lastSeenAt > 0
        ? nextActivities.filter((activity) => toMs(activity.createdAt) > lastSeenAt).length
        : 0);
    } catch (e) { console.warn('[Pulse] Fout:', e.message); }
  }, [activitySeenStorageKey, authFetch]);

  const loadAnalytics = useCallback(async (childUid) => {
    if (!childUid) { setAnalytics(null); setSelectedChildUid(null); return; }
    setSelectedChildUid(childUid);
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      const res = await authFetch(`${BACKEND}/api/parent/analytics/${childUid}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ophalen mislukt.');
      setAnalytics(data);
    } catch (err) { setAnalyticsError(err.message); setAnalytics(null); }
    setAnalyticsLoading(false);
  }, [authFetch]);

  const loadCoparentInvitations = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND}/api/parent/coparent-invitations`);
      const data = await res.json();
      setCoparentInvitations(Array.isArray(data) ? data : []);
    } catch { setCoparentInvitations([]); }
  }, [authFetch]);

  useEffect(() => { loadChildren(); loadActivities(); loadCoparentInvitations(); }, [loadChildren, loadActivities, loadCoparentInvitations]);

  useEffect(() => {
    if (!childDropdownOpen) return;
    const close = () => setChildDropdownOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [childDropdownOpen]);

  useEffect(() => { if (selectedChildUid) loadAnalytics(selectedChildUid); }, [selectedChildUid, loadAnalytics]);

  useEffect(() => {
    setCreateSuccess('');
    setCreateError('');
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'activities') return;
    localStorage.setItem(activitySeenStorageKey, String(Date.now()));
    setUnreadActivityCount(0);
    if (parentActivityBadge > 0) onActivitiesViewed?.();
  }, [activeTab, activitySeenStorageKey, parentActivityBadge, onActivitiesViewed]);

  useEffect(() => {
    setActivityContactFilter('all');
  }, [selectedChildUid]);

  // Auto-refresh analytics elke 30 seconden als Activiteiten-tab open is
  useEffect(() => {
    if (activeTab !== 'activities' || !selectedChildUid) return;
    const interval = setInterval(() => loadAnalytics(selectedChildUid), 30000);
    return () => clearInterval(interval);
  }, [activeTab, selectedChildUid, loadAnalytics]);

  useEffect(() => {
    if (activeTab === 'contacts' && contactsChildUid) loadChildContacts(contactsChildUid);
  }, [activeTab, contactsChildUid, loadChildContacts]);

  useEffect(() => {
    if (inviteModal) loadInviteContacts();
  }, [inviteModal, loadInviteContacts]);

  useEffect(() => {
    if (activeTab !== 'location') return undefined;
    if (!children.length) {
      setLocationByChildUid({});
      setLocationStreamReady(true);
      return undefined;
    }

    setLocationStreamReady(false);
    setLocationError('');
    const unsubscribers = children.map((child) => onSnapshot(
      doc(db, 'users', child.uid),
      (snapshot) => {
        const data = snapshot.data() || {};
        const source = data.liveLocation || {};
        const lat = Number(source.lat ?? source.latitude);
        const lng = Number(source.lng ?? source.longitude ?? source.lon);
        const accuracy = Number(source.accuracy);
        const updatedAtMs = Number(source.updatedAtMs || 0) || toMs(data.liveLocationUpdatedAt);

        setLocationByChildUid((prev) => ({
          ...prev,
          [child.uid]: {
            hasFix: Number.isFinite(lat) && Number.isFinite(lng),
            lat: Number.isFinite(lat) ? lat : null,
            lng: Number.isFinite(lng) ? lng : null,
            accuracy: Number.isFinite(accuracy) ? accuracy : null,
            updatedAtMs,
            sharing: data.liveLocationSharing !== false,
            errorCode: data.liveLocationErrorCode || null,
            errorMessage: data.liveLocationErrorMessage || '',
          },
        }));
        setLocationStreamReady(true);
      },
      (error) => {
        console.warn('[Pulse] Locatie-stream mislukt:', error.message);
        setLocationError('Realtime locatie kon niet worden geladen. Probeer opnieuw.');
        setLocationStreamReady(true);
      },
    ));

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [activeTab, children]);

  async function createChild(e) {
    e.preventDefault();
    setCreateError(''); setCreateSuccess(''); setCreateLoading(true);
    try {
      const check = await checkUsernameAvailability(childUsername);
      if (!check.ok) throw new Error(check.message);
      const res = await authFetch(`${BACKEND}/api/parent/create-child`, {
        method: 'POST',
        body: JSON.stringify({ name: childName.trim(), username: check.clean, password: childPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Aanmaken mislukt.');
      setChildren(prev => [...prev, { uid: data.uid, displayName: data.displayName, username: data.username, online: false, pausedFeatures: { chat: false, call: false, video: false } }]);
      setCreateSuccess(`Account voor ${data.displayName} aangemaakt.`);
      setChildName(''); setChildUsername(''); setChildPassword('');
      setCreateUsernameStatus('');
      window.dispatchEvent(new CustomEvent('pulse:child-added'));
    } catch (err) { setCreateError(err.message); }
    setCreateLoading(false);
  }

  async function validateCreateUsername(value = childUsername) {
    setCreateUsernameStatus('');
    const clean = value.trim().toLowerCase();
    if (!clean) return;
    setCreateUsernameLoading(true);
    try {
      const result = await checkUsernameAvailability(clean);
      setCreateUsernameStatus(result.ok ? 'Beschikbaar' : result.message);
    } catch {
      setCreateUsernameStatus('Controleren van gebruikersnaam mislukt.');
    } finally {
      setCreateUsernameLoading(false);
    }
  }

  async function pauseChild(childUid, feature) {
    setChildError('');
    try {
      const res = await authFetch(`${BACKEND}/api/parent/pause/${childUid}`, {
        method: 'POST',
        body: JSON.stringify({ feature }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Pauzeren mislukt.'); }
      const data = await res.json();
      setChildren(prev => prev.map(c => c.uid === childUid ? { ...c, pausedFeatures: data.pausedFeatures } : c));
    } catch (err) { setChildError(err.message); }
  }

  async function resumeChild(childUid, feature) {
    setChildError('');
    try {
      const res = await authFetch(`${BACKEND}/api/parent/resume/${childUid}`, {
        method: 'POST',
        body: JSON.stringify({ feature }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Hervatten mislukt.'); }
      const data = await res.json();
      setChildren(prev => prev.map(c => c.uid === childUid ? { ...c, pausedFeatures: data.pausedFeatures } : c));
    } catch (err) { setChildError(err.message); }
  }

  async function changePassword(childUid) {
    if (!childUid) {
      setPwError('Geen kind geselecteerd.');
      return;
    }
    if (newPassword.length < 6) {
      setPwSuccess('');
      setPwError('Wachtwoord moet minimaal 6 tekens bevatten.');
      return;
    }
    setPwError('');
    setPwSuccess('');
    setPwLoading(true);
    try {
      const res = await authFetch(`${BACKEND}/api/parent/change-child-password/${childUid}`, {
        method: 'POST',
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Wijzigen mislukt.');
      setPwSuccess('Wachtwoord succesvol gewijzigd.');
      setChangingPwUid(null); setNewPassword(''); setShowNewPw(false);
    } catch (err) { setPwError(err.message); }
    setPwLoading(false);
  }

  async function changeChildUsername(childUid) {
    setUsernameError(''); setUsernameSuccess(''); setUsernameSaving(true);
    try {
      const currentChild = children.find(c => c.uid === childUid);
      const check = await checkUsernameAvailability(editingUsername, currentChild?.username || '');
      if (!check.ok) throw new Error(check.message);
      const res = await authFetch(`${BACKEND}/api/parent/change-child-username/${childUid}`, {
        method: 'POST',
        body: JSON.stringify({ username: check.clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Wijzigen mislukt.');
      setChildren(prev => prev.map(c => c.uid === childUid ? { ...c, username: data.username, email: data.email || c.email } : c));
      setUsernameSuccess('Gebruikersnaam bijgewerkt.');
      setEditingUsernameUid(null);
      setEditingUsername('');
    } catch (err) {
      setUsernameError(err.message);
    } finally {
      setUsernameSaving(false);
    }
  }

  async function deleteChild(childUid) {
    setDeleteError('');
    try {
      const res = await authFetch(`${BACKEND}/api/parent/delete-child/${childUid}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Verwijderen mislukt.'); }
      setChildren(prev => prev.filter(c => c.uid !== childUid));
      setConfirmDelete(null);
      window.dispatchEvent(new CustomEvent('pulse:child-removed'));
    } catch (err) { setDeleteError(err.message); }
  }


  async function sendCoparentInvite() {
    setInviteError(''); setInviteSuccess('');
    if (!inviteModal) return;
    const clean = inviteEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) { setInviteError('Kies eerst een ouderaccount uit je contacten.'); return; }
    setInviteLoading(true);
    try {
      const res = await authFetch(`${BACKEND}/api/parent/invite-coparent`, {
        method: 'POST',
        body: JSON.stringify({ childUid: inviteModal.uid, toEmail: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Versturen mislukt.');
      setInviteSuccess(`Uitnodiging verstuurd naar ${clean}.`);
      setInviteEmail('');
    } catch (err) { setInviteError(err.message); }
    setInviteLoading(false);
  }

  async function acceptCoparentInvitation(inviteId) {
    setInvitationError('');
    setInvitationActionId(inviteId);
    try {
      const res = await authFetch(`${BACKEND}/api/parent/coparent-invitations/${inviteId}/accept`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Accepteren mislukt.');
      setCoparentInvitations(prev => prev.filter(i => i.id !== inviteId));
      loadChildren();
      window.dispatchEvent(new CustomEvent('pulse:child-added'));
    } catch (err) { setInvitationError(err.message); }
    setInvitationActionId(null);
  }

  async function declineCoparentInvitation(inviteId) {
    setInvitationError('');
    setInvitationActionId(inviteId);
    try {
      const res = await authFetch(`${BACKEND}/api/parent/coparent-invitations/${inviteId}/decline`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Weigeren mislukt.');
      setCoparentInvitations(prev => prev.filter(i => i.id !== inviteId));
    } catch (err) { setInvitationError(err.message); }
    setInvitationActionId(null);
  }

  const activityBadgeCount = Math.max(parentActivityBadge, unreadActivityCount);
  const activityTabBadge = activityBadgeCount > 9 ? '9+' : activityBadgeCount;
  const googleMapsTabIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.2c-4.08 0-7.4 3.31-7.4 7.4 0 5.3 6.57 11.68 7.02 12.1a.54.54 0 0 0 .76 0c.45-.42 7.02-6.8 7.02-12.1 0-4.09-3.32-7.4-7.4-7.4z" fill="#EA4335"/>
      <path d="M12 2.2v19.9a.54.54 0 0 1-.38-.16c-.45-.42-7.02-6.8-7.02-12.1 0-4.09 3.32-7.4 7.4-7.4z" fill="#34A853"/>
      <circle cx="12" cy="9.6" r="3.15" fill="#FBBC05"/>
      <circle cx="12" cy="9.6" r="1.55" fill="#4285F4"/>
    </svg>
  );

  const TABS = [
    { id: 'add',        icon: <UserPlus  size={16} aria-hidden="true" />, label: 'Kind toevoegen'  },
    { id: 'children',   icon: <Users     size={16} aria-hidden="true" />, label: 'Mijn kinderen'   },
    { id: 'contacts',   icon: <UserCheck size={16} aria-hidden="true" />, label: 'Contacten'       },
    { id: 'location',   icon: googleMapsTabIcon, label: 'Locatie' },
    { id: 'activities', icon: <Activity  size={16} aria-hidden="true" />, label: 'Activiteiten', badge: activityBadgeCount > 0 ? activityTabBadge : null },
  ];

  const createUsernameReady = createUsernameStatus === 'Beschikbaar';
  const canCreateChild = !createLoading && !!childName.trim() && !!childPassword && childPassword.length >= 6 && createUsernameReady;
  const inviteSearch = inviteContactSearch.trim().toLowerCase();
  const filteredInviteContacts = inviteContacts
    .filter(contact => {
      const email = String(contact.email || '').toLowerCase();
      return contact.uid !== inviteModal?.uid && contact.uid !== user.uid && EMAIL_RE.test(email) && !INTERNAL_ACCOUNT_EMAIL_RE.test(email);
    })
    .filter(contact => {
      if (!inviteSearch) return true;
      return [
        contact.displayName,
        contact.email,
        contact.username,
        contact.nickname,
      ].some(value => String(value || '').toLowerCase().includes(inviteSearch));
    });
  const filteredActivities = selectedChildUid
    ? activities.filter(a => a.childUid === selectedChildUid)
    : activities;
  const portalView = embeddedPortalView !== null
    ? embeddedPortalView
    : portalViewState;
  const setPortalView = useCallback((nextView) => {
    if (onEmbeddedPortalViewChange) {
      onEmbeddedPortalViewChange(nextView);
      return;
    }
    setPortalViewState(nextView);
  }, [onEmbeddedPortalViewChange]);
  const swallowChildActionEvent = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);
  const activeTabMeta = TABS.find((tab) => tab.id === activeTab) || TABS[0];
  const showingMenu = portalView === 'menu';
  const renderPortalContent = () => (
    <>

            {/* Tab 1 — Kind toevoegen */}
            {activeTab === 'add' && (
              <div className="parent-portal-view parent-portal-view--add">
                <div className="parent-portal-section-header">
                  <p className="parent-section-sub">Maak een account aan voor uw kind. Het kind logt in met gebruikersnaam en wachtwoord.</p>
                </div>
                <form onSubmit={createChild} className="parent-portal-form parent-portal-form-card">
                  <input
                    id="child-name"
                    name="childName"
                    className="parent-input"
                    type="text"
                    placeholder="Naam van het kind"
                    aria-label="Naam van het kind"
                    autoComplete="off"
                    value={childName}
                    onChange={e => setChildName(e.target.value)}
                    required
                  />
                  <div className="parent-portal-username-field">
                    <input
                      id="child-username"
                      name="childUsername"
                      className="parent-input"
                      type="text"
                      placeholder="Gebruikersnaam (bijv. jan_2014)"
                      aria-label="Gebruikersnaam"
                      autoComplete="off"
                      value={childUsername}
                      onChange={e => {
                        setChildUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                        setCreateUsernameStatus('');
                        setCreateError('');
                      }}
                      onBlur={() => validateCreateUsername()}
                      autoCapitalize="none"
                      autoCorrect="off"
                      required
                      minLength={3}
                      maxLength={20}
                    />
                    {createUsernameReady && (
                      <span className="parent-portal-username-ready" title="Gebruikersnaam beschikbaar" aria-label="Gebruikersnaam beschikbaar">
                        <Check />
                      </span>
                    )}
                  </div>
                  {createUsernameStatus !== 'Beschikbaar' && (
                    <div
                      className={`parent-portal-helper-text${createUsernameStatus ? ' is-error' : ''}`}
                    >
                      {createUsernameLoading
                        ? 'Gebruikersnaam controleren…'
                        : createUsernameStatus || '3–20 tekens · alleen letters, cijfers en _. Deze loginnaam is uniek binnen Pulse.'}
                    </div>
                  )}
                  <div className="parent-portal-password-field">
                    <input
                      id="child-password"
                      name="childPassword"
                      className="parent-input"
                      type={showCreatePw ? 'text' : 'password'}
                      placeholder="Wachtwoord (minimaal 6 tekens)"
                      aria-label="Wachtwoord"
                      autoComplete="new-password"
                      value={childPassword}
                      onChange={e => setChildPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="parent-portal-password-toggle"
                      aria-label={showCreatePw ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
                      onClick={() => setShowCreatePw(p => !p)}
                    >
                      {showCreatePw ? <EyeOff size={18} aria-hidden="true" /> : <EyeOn size={18} aria-hidden="true" />}
                    </button>
                  </div>
                  <button className="parent-btn-primary" type="submit" disabled={!canCreateChild}>
                    {createLoading ? 'Aanmaken…' : 'Kindaccount aanmaken →'}
                  </button>
                </form>
                {createError && <div className="parent-error" role="alert" aria-live="assertive"><span aria-hidden="true">⚠️ </span>{createError}</div>}
              </div>
            )}

            {/* Tab 2 — Mijn kinderen */}
            {activeTab === 'children' && (
                <div className="parent-portal-view parent-portal-view--children">
                  <div className="parent-portal-toolbar parent-portal-toolbar--spread">
                    <h2 className="parent-section-title">Mijn kinderen</h2>
                    {children.length > 0 && (
                      <div className="parent-portal-picker">
                        <button
                          type="button"
                          className="parent-btn-outline parent-btn-outline--compact parent-btn-outline--picker"
                          aria-label="Kies kind voor kinderenoverzicht"
                          aria-haspopup="listbox"
                          aria-expanded={childDropdownOpen}
                          onClick={e => { e.stopPropagation(); setChildDropdownOpen(o => !o); }}
                        >
                          <span className="parent-child-picker-label">
                            {children.find(c => c.uid === selectedChildUid)?.displayName || 'Kind'}
                          </span>
                          <ChevronDown size={16} aria-hidden="true" />
                        </button>
                        {childDropdownOpen && (
                          <div role="listbox" aria-label="Kies een kind" className="parent-portal-picker-menu">
                            {children.map(c => (
                              <button
                                key={c.uid}
                                type="button"
                                role="option"
                                aria-selected={c.uid === selectedChildUid}
                                className={`parent-portal-picker-option${c.uid === selectedChildUid ? ' active' : ''}`}
                                onClick={() => { setSelectedChildUid(c.uid); setChildDropdownOpen(false); }}
                              >
                                {c.displayName}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                {childError && <div className="parent-error" role="alert" aria-live="assertive"><span aria-hidden="true">⚠️ </span>{childError}</div>}

                {loading ? (
                  <div className="parent-portal-empty-state">Laden…</div>
                ) : children.length === 0 ? (
                  <div className="parent-portal-empty-state" role="status" aria-live="polite">
                    <Users size={40} color="#ccc" style={{ marginBottom: 8 }} aria-hidden="true" />
                    <p>Nog geen kinderen toegevoegd.</p>
                    <p className="parent-portal-inline-sub">Voeg een kind toe via het tabblad "Kind toevoegen".</p>
                  </div>
                ) : children.filter((child) => !selectedChildUid || child.uid === selectedChildUid).map(child => (
                  <div
                    key={child.uid}
                    className={`parent-portal-stack${changingPwUid === child.uid || editingUsernameUid === child.uid || pauseEditorUid === child.uid ? ' parent-portal-stack--editing' : ''}`}
                  >
                    {(() => {
                      const pf = child.pausedFeatures || { chat: false, call: false, video: false };
                      const anyPaused = pf.chat || pf.call || pf.video;
                      return (
                    <div className={`parent-child-row${anyPaused ? ' paused' : ''}`}>
                      {/* Rij 1: Avatar + naam */}
                      <div className="pd-child-head" style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                        <div className="parent-child-avatar" style={{ flexShrink:0 }}>
                          {child.photoURL
                            ? <img src={child.photoURL} alt={child.displayName} style={{ width:'100%', height:'100%', borderRadius:'999px', objectFit:'cover' }} />
                            : getInitials(child.displayName)}
                        </div>
                        <div className="parent-child-copy">
                          <div className="parent-child-header-row">
                            <div className="parent-child-title-group">
                              <div className="parent-child-name">{child.displayName}</div>
                              {child.username && <div className="parent-child-username">@{child.username}</div>}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Rij 2: Knoppen uitgelijnd met avatar */}
                      <div
                        className="pd-child-control-row"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={swallowChildActionEvent}
                        onPointerDown={swallowChildActionEvent}
                        onTouchStart={swallowChildActionEvent}
                      >
                        <div className="pd-child-top-actions pd-child-top-actions--inline">
                          {child.canInviteCoparent && (
                            <button type="button" className="parent-btn-outline pd-child-top-action pd-child-top-action--assign" aria-label={`Wijs ${child.displayName} toe aan andere ouder`} title="Kind toewijzen" style={{ padding:'4px 6px', fontSize: 11, display:'flex', alignItems:'center', gap:6 }}
                              onMouseDown={swallowChildActionEvent}
                              onPointerDown={swallowChildActionEvent}
                              onTouchStart={swallowChildActionEvent}
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPauseEditorUid(null); setInviteModal({ uid: child.uid, displayName: child.displayName }); setInviteEmail(''); setInviteError(''); setInviteSuccess(''); }}>
                              <UserPlus2 size={14} aria-hidden="true" />
                            </button>
                          )}
                          <button type="button" className="parent-btn-outline pd-child-top-action" aria-label={`Wijzig wachtwoord voor ${child.displayName}`} title="Wachtwoord wijzigen"
                            onMouseDown={swallowChildActionEvent}
                            onPointerDown={swallowChildActionEvent}
                            onTouchStart={swallowChildActionEvent}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPauseEditorUid(null); setChangingPwUid(child.uid); setNewPassword(''); setPwError(''); setPwSuccess(''); setShowNewPw(false); }}
                            style={{ padding:'4px 6px' }}>
                            <KeyRound size={15} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="parent-btn-outline pd-child-top-action"
                            aria-label={`Beheer gebruikersnaam voor ${child.displayName}`}
                            title="Gebruikersnaam beheren"
                            onMouseDown={swallowChildActionEvent}
                            onPointerDown={swallowChildActionEvent}
                            onTouchStart={swallowChildActionEvent}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setPauseEditorUid(null);
                              setEditingUsernameUid(child.uid);
                              setEditingUsername(child.username || '');
                              setUsernameError('');
                              setUsernameSuccess('');
                            }}
                            style={{ padding:'4px 6px' }}
                          >
                            <MagicEdit size={15} aria-hidden="true" />
                          </button>
                          <button
                              type="button"
                              className="parent-btn-orange pd-child-top-action pd-child-pause-trigger"
                              aria-label={`Kies functies om te pauzeren voor ${child.displayName}`}
                              title="Pauzeren"
                              aria-expanded={pauseEditorUid === child.uid}
                              onMouseDown={swallowChildActionEvent}
                              onPointerDown={swallowChildActionEvent}
                              onTouchStart={swallowChildActionEvent}
                              onClick={e => { e.preventDefault(); e.stopPropagation(); setChangingPwUid(null); setEditingUsernameUid(null); setPauseEditorUid(current => current === child.uid ? null : child.uid); }}
                            >
                              <PauseCircle size={18} aria-hidden="true" />
                          </button>
                          <button type="button" className="parent-btn-outline pd-child-top-action" aria-label={`Verwijder account van ${child.displayName}`} style={{ color:'#ef4444', borderColor:'#ef4444', padding:'4px 6px' }}
                            onMouseDown={swallowChildActionEvent}
                            onPointerDown={swallowChildActionEvent}
                            onTouchStart={swallowChildActionEvent}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPauseEditorUid(null); setConfirmDelete({ uid: child.uid, displayName: child.displayName }); }}>
                            <Trash2 size={15} color="#ef4444" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                      );
                    })()}

                    {/* Wachtwoord wijzigen inline */}
                    {editingUsernameUid === child.uid && (
                      <div className="parent-child-inline-editor">
                        <p className="parent-child-inline-editor__copy">
                          Gebruikersnaam voor <strong>{child.displayName}</strong>. Deze loginnaam is uniek binnen Pulse en alleen door de ouder te wijzigen.
                        </p>
                        <div className="parent-child-inline-editor__actions">
                          <input
                            className="parent-input"
                            type="text"
                            placeholder="Gebruikersnaam"
                            aria-label="Gebruikersnaam van kind"
                            value={editingUsername}
                            onChange={e => {
                              setEditingUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                              setUsernameError('');
                              setUsernameSuccess('');
                            }}
                            minLength={3}
                            maxLength={20}
                            autoFocus
                            autoCapitalize="none"
                            autoCorrect="off"
                          />
                            <button
                            type="button"
                            className="parent-child-inline-editor__icon-btn parent-child-inline-editor__icon-btn--confirm"
                            aria-label={`Sla gebruikersnaam op voor ${child.displayName}`}
                            onClick={() => changeChildUsername(child.uid)}
                            disabled={usernameSaving || !editingUsername.trim()}
                            title="Gebruikersnaam opslaan">
                            <Check size={22} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="parent-child-inline-editor__icon-btn parent-child-inline-editor__icon-btn--cancel"
                            aria-label={`Annuleer gebruikersnaambewerking voor ${child.displayName}`}
                            onClick={() => { setEditingUsernameUid(null); setEditingUsername(''); setUsernameError(''); setUsernameSuccess(''); }}
                            title="Annuleren">
                            <Cancel size={22} aria-hidden="true" />
                          </button>
                        </div>
                        <div className="parent-child-inline-editor__hint">3–20 tekens · alleen letters, cijfers en _</div>
                        {usernameError && <div className="parent-error" role="alert" aria-live="assertive"><span aria-hidden="true">⚠️ </span>{usernameError}</div>}
                        {usernameSuccess && <div className="parent-success" role="status" aria-live="polite"><span aria-hidden="true">✓ </span>{usernameSuccess}</div>}
                      </div>
                    )}

                    {changingPwUid === child.uid && (
                      <div className="parent-child-inline-editor">
                        <p className="parent-child-inline-editor__copy">Nieuw wachtwoord voor <strong>{child.displayName}</strong>:</p>
                        <div className="parent-child-inline-editor__actions">
                          <div className="parent-portal-password-field parent-portal-password-field--inline">
                            <input
                              className="parent-input"
                              type={showNewPw ? 'text' : 'password'}
                              placeholder="Minimaal 6 tekens"
                              aria-label="Nieuw wachtwoord"
                              value={newPassword}
                              onChange={e => setNewPassword(e.target.value)}
                              minLength={6}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="parent-portal-password-toggle"
                              aria-label={showNewPw ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
                              onClick={() => setShowNewPw(p => !p)}
                            >
                              {showNewPw ? <EyeOff size={16} aria-hidden="true" /> : <EyeOn size={16} aria-hidden="true" />}
                            </button>
                          </div>
                          <button
                            type="button"
                            className="parent-child-inline-editor__icon-btn parent-child-inline-editor__icon-btn--confirm"
                            aria-label={`Sla nieuw wachtwoord op voor ${child.displayName}`}
                            onClick={() => changePassword(child.uid)} disabled={pwLoading || newPassword.length < 6}
                            title="Opslaan">
                            <Check size={22} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="parent-child-inline-editor__icon-btn parent-child-inline-editor__icon-btn--cancel"
                            aria-label={`Annuleer wachtwoordwijziging voor ${child.displayName}`}
                            onClick={() => { setChangingPwUid(null); setNewPassword(''); setPwError(''); setPwSuccess(''); }}
                            title="Annuleren">
                            <Cancel size={22} aria-hidden="true" />
                          </button>
                        </div>
                        {pwError && <div className="parent-error" role="alert" aria-live="assertive"><span aria-hidden="true">⚠️ </span>{pwError}</div>}
                        {pwSuccess && <div className="parent-success" role="status" aria-live="polite"><span aria-hidden="true">✓ </span>{pwSuccess}</div>}
                      </div>
                    )}

                    {pauseEditorUid === child.uid && (
                      <div className="parent-child-inline-editor parent-child-pause-editor">
                        <p className="parent-child-inline-editor__copy">Welke functies wil je pauzeren?</p>
                        <div className="parent-child-pause-options" role="group" aria-label={`Functies pauzeren voor ${child.displayName}`}>
                          {[
                            { id: 'chat', label: 'Chatten', icon: Message },
                            { id: 'call', label: 'Bellen', icon: Phone },
                            { id: 'video', label: 'Videobellen', icon: Video },
                          ].map(({ id, label, icon: Icon }) => {
                            const paused = Boolean(child.pausedFeatures?.[id]);
                            return (
                              <button
                                key={id}
                                type="button"
                                className={`parent-child-pause-option${paused ? ' is-paused' : ''}`}
                                aria-pressed={paused}
                                onClick={() => (paused ? resumeChild(child.uid, id) : pauseChild(child.uid, id))}
                              >
                                <Icon size={17} aria-hidden="true" />
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Tab 3 — Contacten van kind */}
            {activeTab === 'contacts' && (
              <div className="parent-portal-view parent-portal-view--contacts">
                <div className="parent-portal-toolbar parent-portal-toolbar--spread">
                  <h2 className="parent-section-title">Contacten</h2>
                  {children.length > 1 && (
                    <div className="parent-portal-picker">
                      <button
                        type="button"
                        className="parent-btn-outline parent-btn-outline--compact parent-btn-outline--picker"
                        aria-label="Kies kind voor contactenoverzicht"
                        aria-haspopup="listbox"
                        aria-expanded={childDropdownOpen}
                        onClick={e => { e.stopPropagation(); setChildDropdownOpen(v => !v); }}
                      >
                        <span className="parent-child-picker-label">
                          {children.find(c => c.uid === contactsChildUid)?.displayName || 'Selecteer kind'}
                        </span>
                        <ChevronDown size={16} aria-hidden="true" />
                      </button>
                      {childDropdownOpen && (
                        <div role="listbox" aria-label="Kies een kind" className="parent-portal-picker-menu">
                          {children.map(c => (
                            <button
                              key={c.uid}
                              type="button"
                              role="option"
                              aria-selected={c.uid === contactsChildUid}
                              className={`parent-portal-picker-option${c.uid === contactsChildUid ? ' active' : ''}`}
                              onClick={() => { setContactsChildUid(c.uid); setChildDropdownOpen(false); }}
                            >
                              {c.displayName}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="parent-section-sub parent-portal-inline-sub">Bekijk en beheer de contacten van uw kind. U kunt contacten blokkeren of verwijderen.</p>

                {contactsError && <div className="parent-error" role="alert"><span aria-hidden="true">⚠️ </span>{contactsError}</div>}

                {contactsLoading ? (
                  <div className="parent-portal-empty-state">Contacten laden…</div>
                ) : childContacts.length === 0 ? (
                  <div className="parent-portal-empty-state">
                    <Users size={32} color="#ccc" style={{ marginBottom: 8 }} aria-hidden="true" />
                    <p className="parent-portal-inline-sub">Dit kind heeft nog geen contacten.</p>
                  </div>
                ) : (
                  <div className="pd-contacts-list">
                    {childContacts.map(contact => (
                      <div key={contact.uid} className="pd-contact-row">
                        <div className="pd-contact-avatar" aria-hidden="true">{getInitials(contact.displayName)}</div>
                        <div className="pd-contact-info">
                          <div className="pd-contact-name">{contact.displayName}</div>
                          <div className="pd-contact-sub">{contact.email || (contact.username ? `@${contact.username}` : '')}</div>
                        </div>
                        <span className={`pd-contact-status${contact.isParentContact ? ' protected' : contact.isBlocked ? ' blocked' : ''}`}>
                          {contact.isParentContact ? 'Co-ouder' : contact.isBlockedByParent ? 'Geblokkeerd door ouder' : contact.isBlocked ? 'Geblokkeerd' : 'Actief'}
                        </span>
                        <div className="pd-contact-actions">
                          {contact.isParentContact ? (
                            <span className="pd-contact-protected-note">Beveiligd</span>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="parent-btn-outline pd-contact-icon-action"
                                style={{ color: contact.isBlocked ? '#22c55e' : '#f97316', borderColor: contact.isBlocked ? '#22c55e' : '#f97316', opacity: contactActionUid === contact.uid ? 0.6 : 1 }}
                                disabled={contactActionUid === contact.uid}
                                aria-label={contact.isBlocked ? 'Deblokkeren' : 'Blokkeren'}
                                title={contact.isBlocked ? 'Deblokkeren' : 'Blokkeren'}
                                onClick={() => contact.isBlocked
                                  ? parentUnblockContact(contactsChildUid, contact.uid)
                                  : parentBlockContact(contactsChildUid, contact.uid)
                                }
                              >
                                <Block size={17} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className="parent-btn-outline pd-contact-icon-action"
                                style={{ color: '#ef4444', borderColor: '#ef4444', opacity: contactActionUid === contact.uid ? 0.6 : 1 }}
                                disabled={contactActionUid === contact.uid}
                                aria-label="Verwijderen"
                                title="Verwijderen"
                                onClick={() => parentRemoveContact(contactsChildUid, contact.uid)}
                              >
                                <Trash2 size={17} aria-hidden="true" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 4 — Realtime locatie */}
            {activeTab === 'location' && (
              <div className="parent-portal-view parent-portal-view--location">
                <div className="activities-header parent-portal-toolbar parent-portal-toolbar--spread">
                  <h2 className="parent-section-title">Realtime locatie</h2>
                  <button type="button" className="parent-btn-outline activities-refresh-btn" onClick={loadChildren}>
                    <Refresh size={14} aria-hidden="true" />
                  </button>
                </div>
                <p className="parent-section-sub parent-portal-inline-sub">
                  Bekijk de laatst gedeelde live locatie van uw kinderen in ouderlijk toezicht.
                </p>

                {locationError && (
                  <div className="parent-error" role="alert">
                    <span aria-hidden="true">⚠️ </span>{locationError}
                  </div>
                )}

                {!locationStreamReady ? (
                  <div className="parent-portal-empty-state" role="status" aria-live="polite">
                    Locatie laden…
                  </div>
                ) : children.length === 0 ? (
                  <div className="parent-portal-empty-state" role="status" aria-live="polite">
                    <Users size={32} color="#ccc" style={{ marginBottom: 8 }} aria-hidden="true" />
                    <p className="parent-portal-inline-sub">Nog geen kinderen toegevoegd.</p>
                  </div>
                ) : (
                  <div className="pd-location-list">
                    {children.map((child) => {
                      const location = locationByChildUid[child.uid] || null;
                      const hasFix = Boolean(location?.hasFix);
                      const ageMs = location?.updatedAtMs ? Math.max(0, Date.now() - location.updatedAtMs) : Infinity;
                      const statusClass = hasFix
                        ? (ageMs <= LOCATION_STALE_AFTER_MS ? 'live' : (ageMs <= LOCATION_OLD_AFTER_MS ? 'recent' : 'stale'))
                        : 'missing';
                      const statusLabel = hasFix
                        ? (ageMs <= LOCATION_STALE_AFTER_MS ? 'Live' : (ageMs <= LOCATION_OLD_AFTER_MS ? 'Recent' : 'Niet recent'))
                        : (location?.errorCode === 'PERMISSION_DENIED' ? 'Toestemming uit' : 'Geen locatie');
                      const mapsUrl = hasFix ? `https://www.google.com/maps?q=${location.lat},${location.lng}` : null;

                      return (
                        <article key={child.uid} className="pd-location-card">
                          <div className="pd-location-top">
                            <div className="pd-location-user">
                              <div className="pd-location-avatar" aria-hidden="true">
                                {child.photoURL
                                  ? <img src={child.photoURL} alt={child.displayName} className="pd-location-avatar-photo" />
                                  : getInitials(child.displayName)}
                              </div>
                              <div className="pd-location-meta">
                                <strong>{child.displayName}</strong>
                                <span>{formatLocationLastSeen(location?.updatedAtMs || 0)}</span>
                              </div>
                            </div>
                            <span className={`pd-location-status ${statusClass}`}>{statusLabel}</span>
                          </div>

                          {hasFix ? (
                            <div className="pd-location-body">
                              <div className="pd-location-coords">
                                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                              </div>
                              <div className="pd-location-details">
                                Nauwkeurigheid: {location.accuracy ? `±${Math.round(location.accuracy)} m` : 'onbekend'}
                              </div>
                              <div className="pd-location-actions">
                                <a className="parent-btn-outline pd-location-open-map" href={mapsUrl} target="_blank" rel="noreferrer">
                                  Open kaart
                                </a>
                              </div>
                            </div>
                          ) : (
                            <div className="pd-location-empty">
                              {location?.errorCode === 'PERMISSION_DENIED'
                                ? 'Locatie-toestemming staat uit op het apparaat van dit kind.'
                                : (location?.errorMessage || 'Nog geen locatie van dit kind ontvangen.')}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 5 — Activiteiten */}
            {activeTab === 'activities' && (
              <div className="parent-portal-view parent-portal-view--activities">
                {/* Header met kind-selector */}
                <div className="activities-header parent-portal-toolbar parent-portal-toolbar--spread">
                  <h2 className="parent-section-title">Activiteiten</h2>
                  <div className="parent-portal-toolbar-actions">
                    {children.length > 0 && (
                      <div className="parent-portal-picker">
                        <button
                          type="button"
                          className="parent-btn-outline parent-btn-outline--compact parent-btn-outline--picker"
                          aria-label="Kies kind voor activiteitenoverzicht"
                          aria-haspopup="listbox"
                          aria-expanded={childDropdownOpen}
                          onClick={e => { e.stopPropagation(); setChildDropdownOpen(o => !o); }}
                        >
                          <span className="parent-child-picker-label">
                            {children.find(c => c.uid === selectedChildUid)?.displayName || 'Kind'}
                          </span>
                          <ChevronDown size={16} aria-hidden="true" />
                        </button>
                        {childDropdownOpen && (
                          <div role="listbox" aria-label="Kies een kind" className="parent-portal-picker-menu">
                            {children.map(c => (
                              <button
                                key={c.uid}
                                type="button"
                                role="option"
                                aria-selected={c.uid === selectedChildUid}
                                className={`parent-portal-picker-option${c.uid === selectedChildUid ? ' active' : ''}`}
                                onClick={() => { setSelectedChildUid(c.uid); setChildDropdownOpen(false); }}>
                                {c.displayName}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <button type="button" className="parent-btn-outline activities-refresh-btn" onClick={() => { loadActivities(); if (selectedChildUid) loadAnalytics(selectedChildUid); }}>
                      <Refresh size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Compact activiteitenoverzicht voor geselecteerd kind */}
                {selectedChildUid && (
                  <div className="parent-portal-analytics-block">
                    {analyticsLoading && <div className="parent-portal-empty-state" role="status" aria-live="polite">Rapport laden…</div>}
                    {analyticsError && <div className="parent-error" role="alert" aria-live="assertive"><span aria-hidden="true">⚠️ </span>{analyticsError}</div>}
                    {analytics && !analyticsLoading && (() => {
                      const { profile, contacts, sessions, messaging } = analytics;
                      if (!profile || !sessions?.daily || !messaging || !contacts) return null;
                      const fmtSecs = s => { if (!s) return '0m'; const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return h > 0 ? `${h}u ${m}m` : `${m}m`; };
                      const getRelationLabel = (relation) => {
                        if (relation === 'familie') return 'Familie';
                        if (relation === 'vrienden') return 'Vriend';
                        return 'Contact';
                      };
                      const todayKey = new Date().toISOString().slice(0, 10);
                      const todaySession = sessions.daily.find(d => d.date === todayKey);
                      const analyticsContacts = Array.isArray(contacts.list) ? contacts.list : [];
                      const contactCounts = {
                        all: analyticsContacts.length,
                        familie: analyticsContacts.filter((contact) => (contact.relation || '').toLowerCase() === 'familie').length,
                        vrienden: analyticsContacts.filter((contact) => (contact.relation || '').toLowerCase() === 'vrienden').length,
                      };
                      const filteredContacts = (activityContactFilter === 'all'
                        ? analyticsContacts
                        : analyticsContacts.filter((contact) => (contact.relation || '').toLowerCase() === activityContactFilter)
                      ).slice().sort((a, b) => {
                        const relationOrder = { familie: 0, vrienden: 1 };
                        const relationDiff = (relationOrder[a.relation] ?? 9) - (relationOrder[b.relation] ?? 9);
                        if (relationDiff !== 0) return relationDiff;
                        return String(a.displayName || a.email || a.uid).localeCompare(String(b.displayName || b.email || b.uid), 'nl');
                      });
                      const topContactCandidates = Array.isArray(messaging.topContacts) ? messaging.topContacts.filter((contact) => !contact.isGroup) : [];
                      const buildTopList = (metricKey) => topContactCandidates
                        .filter((contact) => Number(contact[metricKey] || 0) > 0)
                        .sort((a, b) => Number(b[metricKey] || 0) - Number(a[metricKey] || 0))
                        .slice(0, 3);
                      const topChatContacts = buildTopList('messagesSent');
                      const topCallContacts = buildTopList('callCount');
                      const topVideoContacts = buildTopList('videoCalls');
                      const statusDot = profile.online
                        ? { background: '#22c55e', boxShadow: '0 0 0 2px #dcfce7' }
                        : { background: '#9ca3af' };
                      const usageCards = [
                        {
                          label: 'Schermtijd vandaag',
                          value: fmtSecs(todaySession?.seconds || 0),
                        },
                        {
                          label: 'Berichten',
                          value: messaging.totalMessagesSent || 0,
                        },
                        {
                          label: 'Oproepen',
                          value: fmtSecs((messaging.totalCallSecs || 0) + (messaging.totalVideoSecs || 0)),
                        },
                        {
                          label: 'Contacten',
                          value: contacts.total || 0,
                        },
                      ];
                      return (
                        <div className="parent-activity-overview">
                          <div className="analytics-profile-card">
                            <div className="analytics-profile-avatar-shell">
                              <UserAvatar
                                photoURL={profile.photoURL || null}
                                displayName={profile.displayName}
                                className="analytics-profile-avatar"
                              />
                              <span className={`analytics-profile-status-dot${profile.online ? ' online' : ' offline'}`} style={statusDot} />
                            </div>
                            <div className="analytics-profile-main">
                              <div className="analytics-profile-info">
                                <div className="analytics-profile-heading">
                                  <span className="analytics-profile-name">{profile.displayName}</span>
                                  {profile.username && <span className="analytics-profile-username">@{profile.username}</span>}
                                </div>
                                <div className={`analytics-profile-status${profile.online ? ' analytics-profile-status--online' : ' analytics-profile-status--offline'}`}>
                                  {profile.online ? <><span aria-hidden="true">● </span>Online</> : `Offline · ${timeAgo(profile.lastSeen, 'Onbekend')}`}
                                </div>
                              </div>
                              <div className="analytics-profile-summary">
                                <div className="analytics-profile-summary-item">
                                  <strong>{contacts.total || 0}</strong>
                                  <span>contacten</span>
                                </div>
                                <div className="analytics-profile-summary-item">
                                  <strong>{messaging.totalMessagesSent || 0}</strong>
                                  <span>berichten</span>
                                </div>
                                <div className="analytics-profile-summary-item">
                                  <strong>{sessions.daily.filter(d => d.seconds > 0).length}</strong>
                                  <span>actieve dagen</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="parent-usage-card analytics-section">
                            <div className="analytics-section-title"><Activity size={15} aria-hidden="true" /> Gebruik vandaag</div>
                            <div className="parent-usage-grid">
                              {usageCards.map(card => (
                                <div key={card.label} className="parent-usage-stat">
                                  <div className="parent-usage-value">{card.value}</div>
                                  <div className="parent-usage-label">{card.label}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="analytics-section parent-top-contacts-card">
                            <div className="analytics-section-title"><Users size={15} aria-hidden="true" /> Contactoverzicht</div>
                            <div className="parent-activity-filter-row" role="group" aria-label="Filter contacten">
                              {[
                                { id: 'all', label: 'Alle' },
                                { id: 'familie', label: 'Familie' },
                                { id: 'vrienden', label: 'Vrienden' },
                              ].map((filter) => (
                                <button
                                  key={filter.id}
                                  type="button"
                                  className={`parent-activity-filter-chip${activityContactFilter === filter.id ? ' active' : ''}`}
                                  aria-pressed={activityContactFilter === filter.id}
                                  onClick={() => setActivityContactFilter(filter.id)}
                                >
                                  {filter.label} <span className="parent-activity-filter-count">{contactCounts[filter.id]}</span>
                                </button>
                              ))}
                            </div>
                            {filteredContacts.length === 0 ? (
                              <div className="parent-top-contacts-empty">Geen contacten in deze filter.</div>
                            ) : (
                              <div className="parent-activity-contacts-list">
                                {filteredContacts.map((contact) => (
                                  <div key={contact.uid} className="parent-activity-contact-row">
                                    <UserAvatar
                                      photoURL={contact.photoURL || null}
                                      displayName={contact.displayName || contact.email || contact.uid}
                                      className="parent-top-contact-avatar"
                                      decorative
                                    />
                                    <div className="parent-top-contact-copy">
                                      <strong>{contact.displayName || contact.email || contact.uid}</strong>
                                      <span>
                                        {contact.username ? `@${contact.username}` : contact.email || getRelationLabel(contact.relation)}
                                      </span>
                                    </div>
                                    <span className="parent-activity-contact-tag">
                                      {getRelationLabel(contact.relation)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="analytics-section parent-top-contacts-card">
                            <div className="analytics-section-title"><Users size={15} aria-hidden="true" /> Top 3 contacten</div>
                            <div className="parent-top-contacts-grid">
                              {[
                                { title: 'Meest chat mee', items: topChatContacts, metric: (contact) => `${contact.messagesSent || 0} chats` },
                                { title: 'Meest belt mee', items: topCallContacts, metric: (contact) => `${contact.callCount || 0} oproepen` },
                                { title: 'Meest videobelt mee', items: topVideoContacts, metric: (contact) => `${contact.videoCalls || 0} videogesprekken` },
                              ].map((section) => (
                                <div key={section.title} className="parent-top-contacts-column">
                                  <div className="parent-top-contacts-column-title">{section.title}</div>
                                  {section.items.length === 0 ? (
                                    <div className="parent-top-contacts-empty">Nog geen data.</div>
                                  ) : (
                                    <div className="parent-top-contacts-list">
                                      {section.items.map((contact, index) => (
                                        <div key={`${section.title}-${contact.uid || index}`} className="parent-top-contact-pill">
                                          <div className="parent-top-contact-rank" aria-hidden="true">{index + 1}</div>
                                          <UserAvatar
                                            photoURL={contact.photoURL || null}
                                            displayName={contact.name}
                                            className="parent-top-contact-avatar"
                                            decorative
                                          />
                                          <div className="parent-top-contact-copy">
                                            <strong>{contact.name}</strong>
                                            <span>{section.metric(contact)}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Activiteitenlogboek */}
                <div className="analytics-section parent-activity-log-card">
                  <div className="analytics-section-title"><Activity size={15} aria-hidden="true" /> Activiteitenlog</div>
                  {filteredActivities.length === 0 ? (
                    <div className="parent-portal-empty-state" role="status" aria-live="polite">
                      <Activity size={32} color="#ccc" style={{ marginBottom: 8 }} aria-hidden="true" />
                      <p className="parent-portal-inline-sub">Nog geen activiteiten voor dit kind.</p>
                    </div>
                  ) : filteredActivities.map(a => (
                    <div key={a.id} className="parent-activity-row">
                      <div className="parent-activity-icon" aria-hidden="true">
                        {a.type === 'friend_request_sent'     && <UserPlus2 size={18} color="#3b82f6" aria-hidden="true" />}
                        {a.type === 'friend_request_accepted' && <UserCheck size={18} color="#22c55e" aria-hidden="true" />}
                        {a.type === 'friend_request_rejected' && <UserX     size={18} color="#ef4444" aria-hidden="true" />}
                        {a.type !== 'friend_request_sent' && a.type !== 'friend_request_accepted' && a.type !== 'friend_request_rejected' && <UserCheck size={18} color="#22c55e" aria-hidden="true" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="parent-activity-text">{a.description}</div>
                        <div className="parent-activity-time">{timeAgo(a.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
    </>
  );

  const renderPortalMenuRows = () => (
    <section className="contact-profile-card contact-profile-card--profile-actions contact-profile-card--parent-actions">
      {TABS.map((tab) => (
        <button
          type="button"
          key={tab.id}
          className="contact-profile-row-button"
          aria-label={tab.badge ? `${tab.label}, ${tab.badge} nieuwe activiteiten` : tab.label}
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setActiveTab(tab.id);
            setPortalView('content');
          }}
        >
          <span className="contact-profile-row-icon parent-badge-anchor" aria-hidden="true">
            {tab.icon}
            {tab.badge && <span className="parent-badge parent-badge--inline">{tab.badge}</span>}
          </span>
          <span className="contact-profile-row-copy">
            <span className="contact-profile-row-title">{tab.label}</span>
          </span>
          <span className="contact-profile-row-arrow" aria-hidden="true">›</span>
        </button>
      ))}
    </section>
  );

  const parentOverlays = (
    <>
      {createSuccess && (
        <PulseConfirmSheet
          title="Account aangemaakt"
          description={createSuccess}
          tone="success"
          onClose={() => setCreateSuccess('')}
          actions={[
            { label: 'Klaar', tone: 'primary', icon: Check, onSelect: () => setCreateSuccess('') },
          ]}
        />
      )}

      {confirmDelete && (
        <PulseConfirmSheet
          title="Account verwijderen"
          description={`Weet u zeker dat u het account van ${confirmDelete.displayName} wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`}
          onClose={() => { setConfirmDelete(null); setDeleteError(''); }}
          actions={[
            { label: 'Verwijderen', tone: 'danger', icon: Trash2, onSelect: () => deleteChild(confirmDelete.uid) },
          ]}
        >
          {deleteError && <div className="parent-error" role="alert" aria-live="assertive"><span aria-hidden="true">⚠️ </span>{deleteError}</div>}
        </PulseConfirmSheet>
      )}

      {inviteModal && (
        <div className="modal-overlay" data-parent-portal-overlay="true" onClick={closeInviteModal}>
          <div className="modal-box coparent-invite-modal" role="dialog" aria-modal="true" aria-labelledby="coparent-invite-title" onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" aria-label="Kind toewijzen sluiten" onClick={closeInviteModal}><span aria-hidden="true">✕</span></button>
            <h2 className="modal-title" id="coparent-invite-title">Kind toewijzen</h2>
            <p style={{ color: 'var(--text2)', fontSize: 14, margin: '10px 0 20px', lineHeight: 1.6 }}>
              Geef een andere ouder toegang tot <strong>{inviteModal.displayName}</strong>. Zij ontvangen een uitnodiging per e-mail en kunnen daarna ook dit kind beheren.
            </p>
            {!inviteSuccess ? (
              <>
                <label htmlFor="coparent-contact-search" className="contact-label" style={{ color: 'var(--text3)', marginBottom: 8 }}>
                  Zoeken in mijn contacten
                </label>
                <input
                  id="coparent-contact-search"
                  type="search"
                  className="parent-input coparent-invite-search"
                  placeholder="Zoek op naam, e-mail of gebruikersnaam"
                  value={inviteContactSearch}
                  onChange={e => setInviteContactSearch(e.target.value)}
                  autoFocus
                  style={{ marginBottom: 10 }}
                />
                <div className="coparent-contact-results" aria-live="polite">
                  {inviteContactsLoading ? (
                    <div className="coparent-contact-empty">Contacten laden…</div>
                  ) : filteredInviteContacts.length > 0 ? (
                    filteredInviteContacts.slice(0, 5).map(contact => (
                      <button
                        key={contact.uid || contact.id || contact.email}
                        type="button"
                        className={`coparent-contact-option${inviteEmail === contact.email ? ' selected' : ''}`}
                        onClick={() => {
                          setInviteEmail(contact.email || '');
                          setInviteContactSearch(contact.displayName || contact.email || '');
                          setInviteError('');
                        }}
                      >
                        <span className="pd-contact-avatar" aria-hidden="true">
                          {contact.photoURL ? <img src={contact.photoURL} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : getInitials(contact.displayName || contact.email)}
                        </span>
                        <span className="coparent-contact-copy">
                          <strong>{contact.displayName || contact.email}</strong>
                          <span>{contact.email}</span>
                        </span>
                        {inviteEmail === contact.email && <Check size={16} aria-hidden="true" />}
                      </button>
                    ))
                  ) : (
                    <div className="coparent-contact-empty">Geen ouderaccount in je contacten gevonden. Voeg de ouder eerst toe als contact en probeer het daarna opnieuw.</div>
                  )}
                </div>
                {inviteError && <div className="parent-error" role="alert" aria-live="assertive" style={{ marginBottom: 12 }}><span aria-hidden="true">⚠️ </span>{inviteError}</div>}
                <div className="modal-actions">
                  <button type="button" className="btn-primary coparent-invite-submit" disabled={inviteLoading || !inviteEmail.trim()} onClick={sendCoparentInvite}>
                    {inviteLoading ? 'Versturen…' : 'Uitnodiging sturen'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="parent-success" role="status" aria-live="polite" style={{ marginBottom: 20 }}>✓ {inviteSuccess}</div>
                <div className="modal-actions">
                  <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={() => { setInviteModal(null); setInviteEmail(''); setInviteSuccess(''); }}>Sluiten</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {coparentInvitations.length > 0 && (
        <div className="modal-overlay" data-parent-portal-overlay="true" onClick={() => {}}>
          <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="coparent-requests-title" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h2 className="modal-title" id="coparent-requests-title">Co-ouder uitnodigingen</h2>
            <p style={{ color: 'var(--text2)', fontSize: 14, margin: '10px 0 20px', lineHeight: 1.6 }}>
              Je hebt {coparentInvitations.length} uitnodiging{coparentInvitations.length > 1 ? 'en' : ''} ontvangen om mede-ouder te worden.
            </p>
            {invitationError && (
              <div className="parent-error" role="alert" aria-live="assertive" style={{ marginBottom: 12 }}>
                <span aria-hidden="true">⚠️ </span>{invitationError}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {coparentInvitations.map(inv => (
                <div key={inv.id} style={{ background: 'var(--surface2, #f5f5fa)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border, #e0e0e8)' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{inv.childName}</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
                    Uitgenodigd door <strong>{inv.fromParentName}</strong> ({inv.fromParentEmail})
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ flex: 1, fontSize: 13, padding: '8px 0', opacity: invitationActionId === inv.id ? 0.6 : 1 }}
                      disabled={invitationActionId === inv.id}
                      onClick={() => acceptCoparentInvitation(inv.id)}
                    >
                      {invitationActionId === inv.id ? 'Verwerken…' : 'Accepteren'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ flex: 1, fontSize: 13, padding: '8px 0', opacity: invitationActionId === inv.id ? 0.6 : 1 }}
                      disabled={invitationActionId === inv.id}
                      onClick={() => declineCoparentInvitation(inv.id)}
                    >
                      Weigeren
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (!embeddedInSidebarCluster) {
    return (
      <>
        <ProfilePageShell
          panelRef={panelRef}
          scrollContent
          titleId="parent-portal-title"
          title={showingMenu ? 'Ouderportaal' : activeTabMeta.label}
          description="Beheer kinderen, contacten, locatie en activiteiten vanuit dezelfde profielopbouw."
          onBack={() => {
            if (showingMenu) onClose?.();
            else setPortalView('menu');
          }}
          backLabel={showingMenu ? 'Ouderportaal sluiten' : 'Terug naar ouderportaal overzicht'}
          headerAction={onClose ? (
            <button
              type="button"
              className="contact-profile-nav-btn contact-profile-close-btn"
              aria-label="Ouderdashboard sluiten"
              title="Sluiten"
              onClick={onClose}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          ) : null}
          className="chat-side-panel contact-profile-panel parent-dashboard-panel"
        >
          {showingMenu ? (
            <>
              {renderPortalMenuRows()}
            </>
          ) : (
            <>
              <section className={`contact-profile-card parent-dashboard-content-card parent-dashboard-content-card--${activeTab}`}>
                <div className="pd-layout pd-layout--sheet parent-dashboard-layout">
                  <div className="pd-content pd-content--sheet parent-dashboard-content">
                    {renderPortalContent()}
                  </div>
                </div>
              </section>
            </>
          )}
        </ProfilePageShell>
        {typeof document !== 'undefined' ? createPortal(parentOverlays, document.body) : null}
      </>
    );
  }

  if (showingMenu) {
    return (
      <div className="pulse-sheet-list pulse-sheet-list--sidebar-actions parent-actions-list parent-actions-list--embedded" role="tablist" aria-label="Ouderportaal onderdelen">
        {TABS.map((t) => (
          <button
            type="button"
            key={t.id}
            className="chat-header-menu-item parent-actions-item parent-actions-item--embedded"
            aria-label={t.badge ? `${t.label}, ${t.badge} nieuwe activiteiten` : t.label}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setActiveTab(t.id);
              setPortalView('content');
            }}
          >
            <span className="parent-actions-icon" aria-hidden="true">
              {t.icon}
              {t.badge && <span className="parent-badge parent-badge--inline">{t.badge}</span>}
            </span>
            <span className="parent-actions-label">{t.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="parent-root parent-root--embedded">
        <div className="parent-container parent-container--embedded">
          <div className="parent-sheet-shell parent-sheet-shell--embedded">
            <div className="pd-layout pd-layout--sheet pd-layout--embedded">
              <div className="parent-embedded-content-shell">
                <div className="pd-content pd-content--sheet pd-content--embedded">
                  {renderPortalContent()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {typeof document !== 'undefined' ? createPortal(parentOverlays, document.body) : null}
    </>
  );
}
