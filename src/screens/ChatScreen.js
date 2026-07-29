// src/screens/ChatScreen.js
import React, { useState, useEffect, useRef, lazy, Suspense, useCallback, useMemo } from 'react';
import { signOut } from 'firebase/auth';
import { canEditMessage, ENCRYPTED_EDIT_UNAVAILABLE_MESSAGE } from '../lib/e2ee/policy';
import { Delete, Message, Trash2 } from '../components/Icons';
import ChatInput from '../components/ChatInput';
import ChatHeader from '../components/ChatHeader';
import ConversationSearchPanel from '../components/ConversationSearchPanel';
import ChatSidebar from '../components/ChatSidebar';
import MessageList from '../components/MessageList';
import MsgContextMenu from '../components/MsgContextMenu';
import BlockConfirmModal from '../components/BlockConfirmModal';
import PulseConfirmSheet from '../components/PulseConfirmSheet';
import useConversations from '../hooks/useConversations';
import useChat from '../hooks/useChat';
import useCalling from '../hooks/useCalling';
import useProfile from '../hooks/useProfile';
import useContacts from '../hooks/useContacts';
import { auth } from '../firebase';
import { clearPulseUserStorage, copyTextToClipboard } from '../utils';

const ChatModals = lazy(() => import('../components/ChatModals'));

export default function ChatScreen({ user, onlineUsers = new Set(), inactiveUsers = new Set(), missedCallAlert, onCallLogRead, isParent, parentActivityBadge = 0, parentToast = null, onDismissParentToast, onOpenDashboard, showParentDashboard = false, setShowParentDashboard, onParentActivitiesViewed, initialConvId = null, onConvIdHandled, serviceTransportReady = false }) {
  const callsAvailable = true;
  // ── UI state ──────────────────────────────────────────────────────────────
  const [text,           setText]           = useState('');
  const [unreadCounts,   setUnreadCounts]   = useState({});
  const [activeTab,      setActiveTab]      = useState('chats');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [chatFilter,     setChatFilter]     = useState('all');
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [convLabels,     setConvLabels]     = useState(() => { try { return JSON.parse(localStorage.getItem(`pulse_labels_${user.uid}`) || '{}'); } catch { return {}; } });
  const [showCallModal,  setShowCallModal]  = useState(false);
  const [callLogRead,    setCallLogRead]    = useState(false);
  const [showGroupInfo,  setShowGroupInfo]  = useState(false);
  const [headerConversationActions, setHeaderConversationActions] = useState(null);
  const [addingMember,   setAddingMember]   = useState(false);
  const [showContactProfile, setShowContactProfile] = useState(false);
  const [contactProfileContact, setContactProfileContact] = useState(null);
  const [confirmDialog,  setConfirmDialog]  = useState(null);
  const [replyTo,        setReplyTo]        = useState(null);
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [conversationPanelMode, setConversationPanelMode] = useState('search');
  const [chatSearch,     setChatSearch]     = useState('');
  const [chatSearchIdx,  setChatSearchIdx]  = useState(0);
  const [deleteMenuMsgId, setDeleteMenuMsgId] = useState(null);
  const [editingMsg,     setEditingMsg]     = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState(null);
  const [forwardMsg,     setForwardMsg]     = useState(null);
  const [dnd, setDnd]   = useState(() => localStorage.getItem('pulse_dnd') === '1');
  const dndRef           = useRef(dnd);
  const [showNewGroup,   setShowNewGroup]   = useState(false);
  const [groupName,      setGroupName]      = useState('');
  const [groupMembers,   setGroupMembers]   = useState([]);
  const [showProfile,    setShowProfile]    = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionSelIdx,  setMentionSelIdx]  = useState(0);
  const [pendingMentions, setPendingMentions] = useState([]);
  const [errToast,       setErrToast]       = useState('');
  const [contextMenu,    setContextMenu]    = useState(null); // { msg, isOwn, x, y }
  const [starredMsgs,    setStarredMsgs]    = useState(() => { try { return JSON.parse(localStorage.getItem(`pulse_starred_${user.uid}`) || '[]'); } catch { return []; } });
  const [pinnedMsgs,     setPinnedMsgs]     = useState(() => { try { return JSON.parse(localStorage.getItem(`pulse_pinned_msgs_${user.uid}`) || '{}'); } catch { return {}; } });
  const [deleteConfirm,  setDeleteConfirm]  = useState(null); // { msgId, isOwn }
  const [showStarredMsgs, setShowStarredMsgs] = useState(false);
  const [jumpToMsgId,     setJumpToMsgId]     = useState(null);
  const [conversationSelectionMode, setConversationSelectionMode] = useState(false);
  const [selectedConversationIds, setSelectedConversationIds] = useState([]);
  const [messageSelectionMode, setMessageSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [mutedConversationIds, setMutedConversationIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`pulse_muted_conversations_${user.uid}`) || '[]'); } catch { return []; }
  });
  const jumpTimer = useRef(null);

  function handleJumpToMsg(msgId) {
    clearTimeout(jumpTimer.current);
    setJumpToMsgId(msgId);
    jumpTimer.current = setTimeout(() => setJumpToMsgId(null), 2500);
  }

  const errToastTimer  = useRef(null);
  const msgCache       = useRef({});
  const msgEndRef      = useRef(null);
  const msgsAreaRef    = useRef(null);
  const textareaRef    = useRef(null);
  const typingTimer    = useRef(null);
  const activeConvRef  = useRef(null);
  const conversationsRef = useRef([]);
  const audioCtxRef    = useRef(null);
  const chatSearchRef  = useRef(null);
  const mutedConversationIdsRef = useRef(mutedConversationIds);

  function showErrToast(msg) {
    setErrToast(msg);
    clearTimeout(errToastTimer.current);
    errToastTimer.current = setTimeout(() => setErrToast(''), 4000);
  }
  function toggleDnd() {
    const next = !dndRef.current;
    dndRef.current = next; setDnd(next);
    localStorage.setItem('pulse_dnd', next ? '1' : '0');
  }
  function persistMutedConversationIds(nextIds) {
    mutedConversationIdsRef.current = nextIds;
    setMutedConversationIds(nextIds);
    localStorage.setItem(`pulse_muted_conversations_${user.uid}`, JSON.stringify(nextIds));
  }
  function toggleConversationMute(convId = activeConv?.id) {
    if (!convId) return;
    const nextIds = mutedConversationIdsRef.current.includes(convId)
      ? mutedConversationIdsRef.current.filter((id) => id !== convId)
      : [...mutedConversationIdsRef.current, convId];
    persistMutedConversationIds(nextIds);
  }
  const handleShowContextMenu = useCallback((e, msg) => {
    e.preventDefault?.();
    if (messageSelectionMode) return;
    setReactionPickerMsgId(null);
    setContextMenu({
      msg,
      isOwn: msg.senderId === user.uid,
      x: e.clientX,
      y: e.clientY,
      anchorRect: e.anchorRect || null,
    });
  }, [messageSelectionMode, user.uid]);
  function handleStar(msgId) {
    setStarredMsgs(prev => {
      const next = prev.includes(msgId) ? prev.filter(id => id !== msgId) : [...prev, msgId];
      localStorage.setItem(`pulse_starred_${user.uid}`, JSON.stringify(next));
      return next;
    });
  }
  function handlePin(msg) {
    const convId = activeConv?.id;
    if (!convId) return;
    setPinnedMsgs(prev => {
      const next = { ...prev };
      if (next[convId]?.id === msg.id) delete next[convId];
      else next[convId] = { id: msg.id, text: msg.text };
      localStorage.setItem(`pulse_pinned_msgs_${user.uid}`, JSON.stringify(next));
      return next;
    });
  }
  function handleDeleteRequest(msg) {
    setContextMenu(null);
    setReactionPickerMsgId(null);
    setMessageSelectionMode(true);
    setSelectedMessageIds([msg.id]);
  }
  function toggleConversationSelection(convId) {
    setSelectedConversationIds((prev) => prev.includes(convId) ? prev.filter((id) => id !== convId) : [...prev, convId]);
  }
  function enterConversationSelection() {
    setConversationSelectionMode(true);
    setSelectedConversationIds([]);
  }
  function cancelConversationSelection() {
    setConversationSelectionMode(false);
    setSelectedConversationIds([]);
  }
  function enterMessageSelection() {
    setContextMenu(null);
    setMessageSelectionMode(true);
    setSelectedMessageIds([]);
  }
  async function openConversationAndRun(conv, action) {
    await openConversation(conv);
    action?.();
  }

  function cancelMessageSelection() {
    setMessageSelectionMode(false);
    setSelectedMessageIds([]);
  }
  function toggleMessageSelection(msgId) {
    setSelectedMessageIds((prev) => prev.includes(msgId) ? prev.filter((id) => id !== msgId) : [...prev, msgId]);
  }
  function openDeleteConversationConfirm(conv) {
    if (!conv?.id) return;
    const conversationName = getConvName(conv) || 'dit gesprek';
    setConfirmDialog({
      title: `Verwijder chat met ${conversationName}?`,
      hideCancel: true,
      confirmLabel: 'Verwijderen',
      confirmIcon: 'trash',
      onConfirm: async () => {
        await deleteConversation?.(null, conv.id, { skipConfirm: true });
      },
    });
  }
  function openClearConversationConfirm(conv) {
    if (!conv?.id) return;
    setConfirmDialog({
      type: 'clear-chat',
      title: 'Deze chat wissen?',
      checkboxLabel: 'Berichten met ster opslaan',
      checkboxDefault: false,
      hideCancel: true,
      confirmLabel: 'Chat wissen',
      confirmIcon: 'trash',
      onConfirm: async ({ keepStarred } = {}) => {
        if (!keepStarred) {
          const cachedMessageIds = Array.isArray(msgCache.current?.[conv.id])
            ? msgCache.current[conv.id].map((message) => message?.id).filter(Boolean)
            : [];
          const openMessageIds = activeConvRef.current?.id === conv.id
            ? (messages || []).map((message) => message?.id).filter(Boolean)
            : [];
          const idsToUnstar = new Set([...cachedMessageIds, ...openMessageIds]);
          if (idsToUnstar.size > 0) {
            setStarredMsgs((prev) => {
              const next = prev.filter((msgId) => !idsToUnstar.has(msgId));
              localStorage.setItem(`pulse_starred_${user.uid}`, JSON.stringify(next));
              return next;
            });
          }
        }
        await clearConversationHistoryHard?.(conv.id);
      },
    });
  }
  function handleDeleteSelectedMessages() {
    if (!selectedMessageIds.length) return;
    const selectedMessageIdSet = new Set(selectedMessageIds);
    const selectedMessages = messages.filter((message) => selectedMessageIdSet.has(message.id));
    const allOwn = selectedMessages.every((message) => message.senderId === user.uid);
    setDeleteConfirm({
      msgIds: selectedMessageIds,
      isOwn: allOwn,
      count: selectedMessageIds.length,
      onComplete: cancelMessageSelection,
    });
  }
  function deleteSelectedConversations() {
    if (!selectedConversationIds.length) return;
    setConfirmDialog({
      title: 'Chats verwijderen',
      message: `${selectedConversationIds.length} gesprek${selectedConversationIds.length === 1 ? '' : 'ken'} verwijderen?`,
      confirmLabel: 'Chats verwijderen',
      confirmIcon: 'trash',
      onConfirm: async () => {
        for (const convId of selectedConversationIds) {
          // eslint-disable-next-line no-await-in-loop
          await deleteConversation(null, convId, { skipConfirm: true });
        }
        cancelConversationSelection();
      },
    });
  }
  const setConvLabel = (convId, label) => {
    const next = label ? { ...convLabels, [convId]: label } : Object.fromEntries(Object.entries(convLabels).filter(([k]) => k !== convId));
    setConvLabels(next);
    localStorage.setItem(`pulse_labels_${user.uid}`, JSON.stringify(next));
  };

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const {
    conversations, setConversations, activeConv, setActiveConv,
    messages, setMessages, loadingConvs, loadingMsgs, hasMore, loadingMore,
    loadConversations, openConversation, deleteConversation, clearConversationHistoryHard, loadMoreMessages,
    sendMessage, stopTyping, retryMessage, retryAllFailed, toggleReaction,
    sendContactCardToConversation,
    forwardToConv, deleteMessage,
    toggleGroupMember, createGroup, renameGroup, promoteGroupAdmin, relinquishGroupAdmin, addMemberToGroup, removeMemberFromGroup, leaveGroup,
    storeTransientConversationMessage,
  } = useConversations({
    user, text, setText, setActiveTab, setShowChatSearch, setChatSearch,
    replyTo, setReplyTo, editingMsg, setEditingMsg, editSubmitting, setEditSubmitting,
    setReactionPickerMsgId, forwardMsg, setForwardMsg,
    pendingMentions, setPendingMentions, setMentionSuggestions,
    setUnreadCounts, convLabels, setConvLabels,
    groupName, setGroupName, groupMembers, setGroupMembers,
    setShowNewGroup, setAddingMember,
    showErrToast, setConfirmDialog,
    msgCache, msgsAreaRef, activeConvRef, conversationsRef, textareaRef, typingTimer,
    serviceTransportReady,
  });

  const {
    contacts, setContacts, pinnedContacts, friendRequests, setFriendRequests,
    contactSuccess, setContactSuccess, showAddContact, setShowAddContact,
    contactEmail, setContactEmail, contactNickname, setContactNickname,
    contactRelation, setContactRelation, contactErr, friendRequestActionErr, contactLoading,
    showNewChat, setShowNewChat, searchEmail, setSearchEmail,
    searchResult, searchErr, friendReqSent, setFriendReqSent, friendReqLoading,
    pendingFriendRequest,
    sentFriendRequests, showFriendRequestsPanel, setShowFriendRequestsPanel,
    renamingContact, setRenamingContact, sharingContact, setSharingContact,
    shareRecipients, setShareRecipients, viewingSharedContact, setViewingSharedContact,
    renameValue, setRenameValue,
    loadContacts, loadFriendRequests, loadBlockedContacts,
    getContactNickname, saveContactNickname, getContactDisplayName, findConvWithUid,
    addContact, sendFriendRequestToEmail, remindPendingFriendRequest, cancelPendingFriendRequest, acceptFriendRequest, declineFriendRequest,
    remindFriendRequestById, cancelFriendRequestById,
    removeContact, togglePin, startChatWithContact, searchUser, startConversationWith,
    clearPendingFriendRequestState,
    blockedContacts, setBlockedContacts,
    parentBlockedUids, setParentBlockedUids,
    blockingContact, setBlockingContact, blockContact, unblockContact,
  } = useContacts({
    user, conversations, setConversations, activeConv, setActiveConv,
    setMessages, setConvLabels, openConversation, loadConversations,
    showErrToast, setConfirmDialog,
  });

  const { typing, typingName, typingByConv, pausedFeatures, mentionToast, clearMentionToast } = useChat({
    user, activeConvRef, conversationsRef, msgsAreaRef, dndRef, audioCtxRef,
    mutedConversationIdsRef,
    loadConversations, loadContacts, loadFriendRequests, setMessages, setConversations, setUnreadCounts,
    setFriendRequests, setContactSuccess, setShowFriendRequestsPanel, setContacts, setActiveConv,
    setBlockedContacts, setParentBlockedUids, showErrToast, setConfirmDialog,
    onReconnect: retryAllFailed,
    onOpenMentionConversation: openConversation,
    onTransientMessage: storeTransientConversationMessage,
  });

  useEffect(() => {
    mutedConversationIdsRef.current = mutedConversationIds;
  }, [mutedConversationIds]);

  useEffect(() => {
    cancelMessageSelection();
  }, [activeConv?.id]);

  const { activeCall, setActiveCall, getCallLog, refreshCallLog, clearCallLog, callLogRateLimitUntil, callContact, callContactFromRecent, initiateCall, initiateCallFromConv } = useCalling({
    user, pausedFeatures, activeConvRef, msgsAreaRef,
    setMessages, loadConversations, findConvWithUid, setShowCallModal, showErrToast,
  });

  const {
    profileTab, setProfileTab, newName, setNewName, photoPreview, setPhotoPreview,
    profileLoading, profileMsg, setProfileMsg, newUsername, newPassword, setNewPassword,
    confirmPassword, setConfirmPassword, showNewPassword, setShowNewPassword,
    passwordLoading, passwordMsg, chatBg, chatBgLoading, chatBgTab, setChatBgTab,
    chatBgMsg, showAvatarBuilder, setShowAvatarBuilder, avatarOptions, setAvatarOptions,
    groupPhotoLoading, historyRules, setHistoryRules,
    childHistoryRulesByUid, setChildHistoryRulesByUid,
    historyChildren, historySettingsLoading, historySettingsSavingTarget, historySettingsMsg,
    photoInputRef, bgInputRef, openProfile,
    handlePhotoChange, saveProfile, changePassword,
    uploadChatBgPhoto, saveChatBgColor, removeChatBg, uploadGroupPhoto, handleDeleteAccount,
    loadHistorySettings, saveHistorySettings, saveChildHistorySettings,
  } = useProfile({ user, activeConv, setActiveConv, setConversations, showErrToast, setConfirmDialog, isParent });

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => () => clearTimeout(typingTimer.current), []);
  useEffect(() => {
    if (!initialConvId || !conversations.length) return;
    const conv = conversations.find(c => c.id === initialConvId);
    if (conv) { openConversation(conv); onConvIdHandled?.(); }
  }, [conversations, initialConvId, onConvIdHandled, openConversation]);
  // Intentionally run once on mount to avoid re-fetch loops from recreated callbacks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadConversations(); loadContacts(); loadFriendRequests(); loadBlockedContacts(); }, []);
  useEffect(() => {
    const handler = () => { loadContacts(); loadConversations(); };
    window.addEventListener('pulse:child-added', handler);
    window.addEventListener('pulse:child-removed', handler);
    return () => { window.removeEventListener('pulse:child-added', handler); window.removeEventListener('pulse:child-removed', handler); };
  }, [loadContacts, loadConversations]);
  useEffect(() => {
    if (!conversations.length || !contacts.length) return;
    const stored = (() => { try { return JSON.parse(localStorage.getItem(`pulse_labels_${user.uid}`) || '{}'); } catch { return {}; } })();
    let updated = false;
    contacts.forEach(contact => {
      const rel = contact.relation;
      if (rel !== 'familie' && rel !== 'vrienden') return;
      const conv = conversations.find(c => !c.isGroup && c.members?.includes(contact.id || contact.uid));
      if (conv && !stored[conv.id]) { stored[conv.id] = rel; updated = true; }
    });
    const pending = (() => { try { return JSON.parse(localStorage.getItem(`pulse_pending_labels_${user.uid}`) || '{}'); } catch { return {}; } })();
    let pendingChanged = false;
    Object.entries(pending).forEach(([uid, rel]) => {
      const conv = conversations.find(c => !c.isGroup && c.members?.includes(uid));
      if (conv && !stored[conv.id]) { stored[conv.id] = rel; updated = true; delete pending[uid]; pendingChanged = true; }
    });
    if (pendingChanged) localStorage.setItem(`pulse_pending_labels_${user.uid}`, JSON.stringify(pending));
    if (updated) { localStorage.setItem(`pulse_labels_${user.uid}`, JSON.stringify(stored)); setConvLabels(stored); }
  }, [conversations, contacts, user.uid]);
  useEffect(() => {
    if (!deleteMenuMsgId) return;
    const close = () => setDeleteMenuMsgId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [deleteMenuMsgId]);
  useEffect(() => {
    if (!reactionPickerMsgId) return;
    const close = (event) => {
      if (event.key === 'Escape') setReactionPickerMsgId(null);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [reactionPickerMsgId]);
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== 'Escape') return;
      if (showAddContact) { setShowAddContact(false); setContactEmail(''); }
      else if (showNewChat)   { setShowNewChat(false); setSearchEmail(''); }
      else if (showNewGroup)  { setShowNewGroup(false); setGroupName(''); setGroupMembers([]); }
      else if (showProfile)   setShowProfile(false);
      else if (showCallModal) setShowCallModal(false);
      else if (showGroupInfo) { setShowGroupInfo(false); setAddingMember(false); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [setContactEmail, setSearchEmail, setShowAddContact, setShowNewChat, showAddContact, showCallModal, showGroupInfo, showNewChat, showNewGroup, showProfile]);

  const visibleMessages = useMemo(
    () => {
      const blockedUidSet = new Set(blockedContacts.map((contact) => contact.uid));
      return messages.filter((message) => (
        message.senderId === user.uid || !blockedUidSet.has(message.senderId)
      ));
    },
    [blockedContacts, messages, user.uid],
  );
  const handleMessageReaction = useCallback((msgId, emoji) => {
    toggleReaction(msgId, emoji);
  }, [toggleReaction]);
  const handleMessageRetry = useCallback((msg) => {
    retryMessage(msg);
  }, [retryMessage]);
  const handleOpenReactionPicker = useCallback((msgId) => {
    setContextMenu(null);
    setReactionPickerMsgId((current) => (current === msgId ? current : msgId));
  }, []);
  const handleCloseReactionPicker = useCallback(() => {
    setReactionPickerMsgId(null);
  }, []);
  const openUnifiedContactProfile = useCallback((contact, options = {}) => {
    if (!contact) return;
    setRenameValue(getContactNickname(contact.uid) || contact.displayName || '');
    setContactProfileContact(contact);
    if (!options.preserveActiveConversation) {
      startChatWithContact(contact);
    }
    setShowContactProfile(true);
  }, [getContactNickname, setRenameValue, startChatWithContact]);
  const handleViewSharedContact = useCallback((sc) => {
    const existingContact = contacts.find((contact) =>
      (sc?.uid && contact.uid === sc.uid)
      || (!!sc?.email && !!contact.email && contact.email.toLowerCase() === sc.email.toLowerCase())
    );
    if (existingContact) {
      openUnifiedContactProfile(existingContact);
      return;
    }
    setFriendReqSent(false);
    setViewingSharedContact({ ...sc, isAlreadyContact: contacts.some(c => c.uid === sc?.uid) });
  }, [contacts, openUnifiedContactProfile, setFriendReqSent, setViewingSharedContact]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function sendContactCard(toContact, sharedContact) {
    const conv = findConvWithUid(toContact.uid);
    if (!conv) return;
    sendContactCardToConversation(conv, {
      uid: sharedContact.uid,
      name: getContactDisplayName(sharedContact),
      email: sharedContact.email || '',
    });
    setSharingContact(null);
  }
  const contactsByUid = useMemo(() => new Map(contacts.map((contact) => [contact.uid, contact])), [contacts]);
  const getOtherUid = useCallback((conv) => {
    if (conv?.isGroup) return null;
    return conv?.members?.find((memberUid) => memberUid !== user.uid);
  }, [user.uid]);
  const getConvName = useCallback((conv) => {
    if (conv.isGroup) return conv.groupName || 'Groepsgesprek';
    const otherUid = getOtherUid(conv);
    const liveContact = contactsByUid.get(otherUid);
    return getContactDisplayName(liveContact || { uid: otherUid, displayName: conv.memberNames?.[otherUid] || '' }) || conv.memberNames?.[otherUid] || 'Contactpersoon';
  }, [contactsByUid, getContactDisplayName, getOtherUid]);
  const getConvPhoto = useCallback((conv) => {
    if (conv.isGroup) return null;
    return contactsByUid.get(getOtherUid(conv))?.photoURL || null;
  }, [contactsByUid, getOtherUid]);
  const handleMessageStartCall = useCallback(({ toUid, convId, name, isVideo }) => {
    const currentConv = activeConv?.id === convId ? activeConv : null;
    const effectiveUid = currentConv ? (getOtherUid(currentConv) || toUid) : toUid;
    const contact = contactsByUid.get(effectiveUid);
    if (contact) {
      callContact(contact, isVideo);
      return;
    }
    const effectiveName = currentConv ? getConvName(currentConv) : name;
    initiateCallFromConv({
      id: convId,
      members: [user.uid, effectiveUid],
      memberNames: { [effectiveUid]: effectiveName },
    }, isVideo);
  }, [activeConv, callContact, contactsByUid, getConvName, getOtherUid, initiateCallFromConv, user.uid]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app-screen">

      <ChatSidebar
        user={user}
        onlineUsers={onlineUsers} inactiveUsers={inactiveUsers}
        dnd={dnd} onToggleDnd={toggleDnd}
        missedCallAlert={missedCallAlert} callLogRead={callLogRead}
        getCallLog={getCallLog} onCallLogRead={onCallLogRead}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        activeTab={activeTab} setActiveTab={setActiveTab}
        chatFilter={chatFilter} setChatFilter={setChatFilter}
        selectedGroupId={selectedGroupId} setSelectedGroupId={setSelectedGroupId}
        friendRequests={friendRequests} sentFriendRequests={sentFriendRequests}
        showFriendRequestsPanel={showFriendRequestsPanel} setShowFriendRequestsPanel={setShowFriendRequestsPanel}
        contacts={contacts} conversations={conversations}
        sharingContact={sharingContact} setSharingContact={setSharingContact}
        shareRecipients={shareRecipients} setShareRecipients={setShareRecipients}
        onShareContact={sendContactCard}
        activeConv={activeConv} showChatSearch={showChatSearch} loadingConvs={loadingConvs}
        convLabels={convLabels} pinnedContacts={pinnedContacts}
        unreadCounts={unreadCounts} typingByConv={typingByConv} photoPreview={photoPreview}
        isParent={isParent} parentActivityBadge={parentActivityBadge}
        onOpenDashboard={onOpenDashboard}
        showParentDashboard={showParentDashboard}
        setShowParentDashboard={setShowParentDashboard}
        onParentActivitiesViewed={onParentActivitiesViewed}
        setLabelMenuConvId={() => {}}
        showNewChat={showNewChat}
        setShowNewChat={setShowNewChat}
        searchEmail={searchEmail}
        setSearchEmail={setSearchEmail}
        searchErr={searchErr}
        searchResult={searchResult}
        searchUser={searchUser}
        startConversationWith={startConversationWith}
        showNewGroup={showNewGroup}
        setShowNewGroup={setShowNewGroup}
        groupName={groupName}
        setGroupName={setGroupName}
        groupMembers={groupMembers}
        toggleGroupMember={toggleGroupMember}
        createGroup={createGroup}
        onShowCallModal={() => {
          setShowCallModal(true);
          setCallLogRead(true);
          onCallLogRead?.();
          refreshCallLog();
        }}
        showCallModal={showCallModal}
        setShowCallModal={setShowCallModal}
        showAddContact={showAddContact}
        setShowAddContact={setShowAddContact}
        contactEmail={contactEmail}
        setContactEmail={setContactEmail}
        contactNickname={contactNickname}
        setContactNickname={setContactNickname}
        contactRelation={contactRelation}
        setContactRelation={setContactRelation}
        contactErr={contactErr}
        contactLoading={contactLoading}
        addContact={addContact}
        clearPendingFriendRequestState={clearPendingFriendRequestState}
        onOpenProfile={() => { setShowProfile(true); openProfile(); }}
        showProfile={showProfile}
        contactProfileVisible={showContactProfile}
        onCloseContactProfile={() => { setShowContactProfile(false); setContactProfileContact(null); }}
        groupInfoVisible={showGroupInfo}
        onCloseGroupInfo={() => setShowGroupInfo(false)}
        onShowChatsFromContextPanel={() => setActiveConv(null)}
        setShowProfile={setShowProfile}
        profileTab={profileTab}
        setProfileTab={setProfileTab}
        newName={newName}
        setNewName={setNewName}
        newUsername={newUsername}
        showNewPassword={showNewPassword}
        setShowNewPassword={setShowNewPassword}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        passwordLoading={passwordLoading}
        passwordMsg={passwordMsg}
        profileMsg={profileMsg}
        profileLoading={profileLoading}
        historyRules={historyRules}
        setHistoryRules={setHistoryRules}
        childHistoryRulesByUid={childHistoryRulesByUid}
        setChildHistoryRulesByUid={setChildHistoryRulesByUid}
        historyChildren={historyChildren}
        historySettingsLoading={historySettingsLoading}
        historySettingsSavingTarget={historySettingsSavingTarget}
        historySettingsMsg={historySettingsMsg}
        chatBgTab={chatBgTab}
        setChatBgTab={setChatBgTab}
        chatBgMsg={chatBgMsg}
        chatBg={chatBg}
        chatBgLoading={chatBgLoading}
        saveProfile={saveProfile}
        changePassword={changePassword}
        saveHistorySettings={saveHistorySettings}
        saveChildHistorySettings={saveChildHistorySettings}
        uploadChatBgPhoto={uploadChatBgPhoto}
        saveChatBgColor={saveChatBgColor}
        removeChatBg={removeChatBg}
        handlePhotoChange={handlePhotoChange}
        handleDeleteAccount={handleDeleteAccount}
        photoInputRef={photoInputRef}
        bgInputRef={bgInputRef}
        setShowAvatarBuilder={setShowAvatarBuilder}
        onProfileHistoryOpen={loadHistorySettings}
        onRequestSettingsLogout={() => {
          setConfirmDialog({
            title: 'Uitloggen',
            message: 'Weet je zeker dat je wilt uitloggen?',
            hideCancel: true,
            confirmLabel: 'Uitloggen',
            confirmIcon: 'logout',
            onConfirm: async () => {
              clearPulseUserStorage(user.uid);
              await signOut(auth);
            },
          });
        }}
        onAcceptFriendRequest={acceptFriendRequest}
        onDeclineFriendRequest={declineFriendRequest}
        onRemindFriendRequest={remindFriendRequestById}
        onCancelFriendRequest={cancelFriendRequestById}
        onTogglePin={togglePin}
        onViewContact={openUnifiedContactProfile}
        onStartChat={startChatWithContact} onCallContact={callContact}
        onRemoveContact={removeContact}
        onBlockContact={contact => setBlockingContact(contact)}
        onUnblockContact={unblockContact}
        blockedContacts={blockedContacts}
        parentBlockedUids={parentBlockedUids}
        onOpenConversation={openConversation}
        onCallFromConv={initiateCallFromConv}
        onClearConversation={(conv) => {
          openClearConversationConfirm(conv);
        }}
        onHardDeleteConversation={(conv) => {
          openDeleteConversationConfirm(conv);
        }}
        onToggleConversationMute={toggleConversationMute}
        onShowGroupInfo={(conv) => openConversationAndRun(conv, () => setShowGroupInfo(true))}
        onEnterMessageSelectionForConversation={(conv) => openConversationAndRun(conv, enterMessageSelection)}
        onShowStarredForConversation={(conv) => openConversationAndRun(conv, () => setShowStarredMsgs(true))}
        onLeaveGroup={(conv) => openConversationAndRun(conv, leaveGroup)}
        conversationActionsRequest={headerConversationActions}
        onConversationActionsRequestHandled={() => setHeaderConversationActions(null)}
        mutedConversationIds={mutedConversationIds}
        selectionMode={conversationSelectionMode}
        selectedConversationIds={selectedConversationIds}
        onToggleConversationSelection={toggleConversationSelection}
        onEnterConversationSelection={enterConversationSelection}
        onCancelConversationSelection={cancelConversationSelection}
        onDeleteSelectedConversations={deleteSelectedConversations}
        getConvName={getConvName} getOtherUid={getOtherUid} getConvPhoto={getConvPhoto}
        getContactDisplayName={getContactDisplayName}
        callsAvailable={callsAvailable}
        callContact={callContact}
        callContactFromRecent={callContactFromRecent}
        callLogRateLimitUntil={callLogRateLimitUntil}
        setPhotoPreview={setPhotoPreview}
      />

      <main className="chat-main" aria-label={activeConv ? `Chatvenster voor ${getConvName(activeConv)}` : 'Chatvenster'}>
        {!activeConv ? (
          <div className="empty-state" role="status" aria-live="polite" aria-labelledby="chat-empty-title" aria-describedby="chat-empty-description">
            <div className="empty-icon" aria-hidden="true"><Message size={48} /></div>
            <div className="empty-title" id="chat-empty-title">Kies een gesprek</div>
            <p id="chat-empty-description" className="chat-empty-description-inline">
              Of klik op het{' '}
              <span className="chat-empty-description-icon" aria-hidden="true">
                <Message size={14} style={{ verticalAlign: 'middle', margin: '0 2px', color: 'currentColor' }} />
              </span>{' '}
              om een nieuwe chat te beginnen.
            </p>
          </div>
        ) : (
          <>
            <ChatHeader
              activeConv={activeConv} onlineUsers={onlineUsers} inactiveUsers={inactiveUsers}
              unreadCounts={unreadCounts}
              onBack={() => setActiveConv(null)} onInitiateCall={initiateCall}
              onShowGroupInfo={() => setShowGroupInfo(true)}
              onShowContactProfile={() => { setContactProfileContact(null); setShowContactProfile(true); }}
              onToggleConversationMute={() => toggleConversationMute(activeConv?.id)}
              onEnterMessageSelection={() => messageSelectionMode ? cancelMessageSelection() : enterMessageSelection()}
              onShowStarredMsgs={() => setShowStarredMsgs(true)}
              onShowConversationActions={() => setHeaderConversationActions(activeConv)}
              onLeaveGroup={leaveGroup}
              onClearChat={() => {
                openClearConversationConfirm(activeConv);
              }}
              onDeleteChat={() => {
                openDeleteConversationConfirm(activeConv);
              }}
              parentBlockedOtherUid={!activeConv?.isGroup && parentBlockedUids.includes(getOtherUid(activeConv))}

              setRenameValue={setRenameValue}
              getConvName={getConvName} getOtherUid={getOtherUid} getConvPhoto={getConvPhoto}
              getContactNickname={getContactNickname}
              serviceTransportReady={serviceTransportReady}
              callsAvailable={callsAvailable}
              conversationMuted={mutedConversationIds.includes(activeConv?.id)}
              messageSelectionMode={messageSelectionMode}
            />
            {pinnedMsgs[activeConv?.id] && (
              <div className="pinned-msg-bar" role="status" aria-live="polite">
                <span className="pinned-msg-icon" aria-hidden="true">📌</span>
                <div className="pinned-msg-text">{pinnedMsgs[activeConv.id].text}</div>
                <button type="button" className="pinned-msg-close" aria-label="Losmaken" onClick={() => handlePin(pinnedMsgs[activeConv.id])}><span aria-hidden="true">✕</span></button>
              </div>
            )}
            <MessageList
              user={user}
              contacts={contacts}
              currentUserPhotoURL={photoPreview || user.photoURL}
              messages={visibleMessages}
              activeConv={activeConv} currentUid={user.uid}
              chatSearch={chatSearch} chatSearchIdx={chatSearchIdx}
              chatBg={chatBg}
              hasMore={hasMore} loadingMore={loadingMore} loadingMsgs={loadingMsgs}
              showChatSearch={showChatSearch} msgsAreaRef={msgsAreaRef} msgEndRef={msgEndRef}
              typing={typing}
              typingName={typingName}
              onLoadMore={loadMoreMessages}
              onCloseSearch={() => { setShowChatSearch(false); setChatSearch(''); }}
              onReact={handleMessageReaction}
              onShowContextMenu={handleShowContextMenu}
              onOpenReactionPicker={handleOpenReactionPicker}
              reactionPickerMsgId={reactionPickerMsgId}
              onCloseReactionPicker={handleCloseReactionPicker}
              jumpToMsgId={jumpToMsgId}
              onRetry={handleMessageRetry}
              onStartCall={callsAvailable ? handleMessageStartCall : undefined}
              onViewContact={handleViewSharedContact}
              selectionMode={messageSelectionMode}
              selectedMessageIds={selectedMessageIds}
              onToggleMessageSelection={toggleMessageSelection}
            />
            {(() => {
              const blockedOtherUid = !activeConv.isGroup && getOtherUid(activeConv);
              const isBlockedConv   = blockedOtherUid && blockedContacts.some(c => c.uid === blockedOtherUid);
              const isParentBlocked = blockedOtherUid && parentBlockedUids.includes(blockedOtherUid);
              return messageSelectionMode ? (
                <div className="chat-message-selection-bar" role="toolbar" aria-label="Berichten selecteren">
                  <button
                    type="button"
                    className="chat-message-selection-delete"
                    disabled={!selectedMessageIds.length}
                    onClick={handleDeleteSelectedMessages}
                    aria-label={`${selectedMessageIds.length || 'Geen'} geselecteerde ${selectedMessageIds.length === 1 ? 'bericht' : 'berichten'} verwijderen`}
                    title="Verwijderen"
                  >
                    <Delete size={27} aria-hidden="true" />
                  </button>
                  <div className="chat-message-selection-count">{selectedMessageIds.length} geselecteerd</div>
                  <button type="button" className="chat-message-selection-close" aria-label="Berichtselectie sluiten" onClick={cancelMessageSelection}>
                    <span aria-hidden="true">✕</span>
                  </button>
                </div>
              ) : isBlockedConv ? (
                <div className="blocked-input-overlay" role="status" aria-live="polite">
                  {isParentBlocked
                    ? 'Dit contact is geblokkeerd door je ouder.'
                    : <><span>Je hebt dit contact geblokkeerd.</span> <button type="button" className="blocked-input-unblock" onClick={() => unblockContact(blockedOtherUid)}>Deblokkeren</button></>
                  }
                </div>
              ) : (
                <ChatInput
                  text={text} setText={setText}
                  editingMsg={editingMsg} setEditingMsg={setEditingMsg}
                  editSubmitting={editSubmitting}
                  replyTo={replyTo} setReplyTo={setReplyTo}
                  mentionSuggestions={mentionSuggestions} setMentionSuggestions={setMentionSuggestions}
                  mentionSelIdx={mentionSelIdx} setMentionSelIdx={setMentionSelIdx}
                  setPendingMentions={setPendingMentions}
                  pausedFeatures={pausedFeatures} activeConv={activeConv}
                  user={user} contacts={contacts}
                  textareaRef={textareaRef} activeConvRef={activeConvRef}
                  typingTimerRef={typingTimer} stopTyping={stopTyping} onSend={sendMessage}
                />
              );
            })()}
          </>
        )}
      </main>

      {activeConv && showChatSearch && (
        <ConversationSearchPanel
          activeConv={activeConv}
          messages={messages}
          chatSearch={chatSearch}
          setChatSearch={setChatSearch}
          chatSearchIdx={chatSearchIdx}
          setChatSearchIdx={setChatSearchIdx}
          chatSearchRef={chatSearchRef}
          getConvName={getConvName}
          mode={conversationPanelMode}
          starredMsgs={starredMsgs}
          onClose={() => { setShowChatSearch(false); setConversationPanelMode('search'); }}
        />
      )}

      <Suspense fallback={null}>
      <ChatModals
        renamingContact={renamingContact} setRenamingContact={setRenamingContact}
        renameValue={renameValue} setRenameValue={setRenameValue}
        saveContactNickname={saveContactNickname} setContacts={setContacts}
        sharingContact={sharingContact} setSharingContact={setSharingContact}
        shareRecipients={shareRecipients} setShareRecipients={setShareRecipients}
        shareContactInSidebar
        contacts={contacts} sendContactCard={sendContactCard}
        getContactDisplayName={getContactDisplayName}
        viewingSharedContact={viewingSharedContact} setViewingSharedContact={setViewingSharedContact}
        onlineUsers={onlineUsers} inactiveUsers={inactiveUsers}
        friendReqLoading={friendReqLoading} friendReqSent={friendReqSent}
        sendFriendRequestToEmail={sendFriendRequestToEmail}
        findConvWithUid={findConvWithUid} setConvLabel={setConvLabel} convLabels={convLabels}
        getContactNickname={getContactNickname}
        confirmDialog={confirmDialog} setConfirmDialog={setConfirmDialog}
        addContactSheetInSidebar
        showAddContact={showAddContact} setShowAddContact={setShowAddContact}
        contactEmail={contactEmail} setContactEmail={setContactEmail}
        contactNickname={contactNickname} setContactNickname={setContactNickname}
        contactRelation={contactRelation} setContactRelation={setContactRelation}
        contactErr={contactErr}
        friendRequestActionErr={friendRequestActionErr}
        contactLoading={contactLoading}
        addContact={addContact}
        pendingFriendRequest={pendingFriendRequest}
        remindPendingFriendRequest={remindPendingFriendRequest}
        cancelPendingFriendRequest={cancelPendingFriendRequest}
        clearPendingFriendRequestState={clearPendingFriendRequestState}
        friendRequests={friendRequests}
        sentFriendRequests={sentFriendRequests}
        showFriendRequestsPanel={showFriendRequestsPanel} setShowFriendRequestsPanel={setShowFriendRequestsPanel}
        friendRequestsSheetInSidebar
        onAcceptFriendRequest={acceptFriendRequest}
        onDeclineFriendRequest={declineFriendRequest}
        onRemindFriendRequest={remindFriendRequestById}
        onCancelFriendRequest={cancelFriendRequestById}
        showNewChat={showNewChat} setShowNewChat={setShowNewChat}
        searchEmail={searchEmail} setSearchEmail={setSearchEmail}
        searchErr={searchErr} searchResult={searchResult}
        searchUser={searchUser} startConversationWith={startConversationWith}
        newGroupSheetInSidebar
        showNewGroup={showNewGroup} setShowNewGroup={setShowNewGroup}
        groupName={groupName} setGroupName={setGroupName}
        groupMembers={groupMembers} toggleGroupMember={toggleGroupMember} createGroup={createGroup}
        photoPreview={photoPreview} setPhotoPreview={setPhotoPreview}
        user={user}
        setProfileMsg={setProfileMsg}
        avatarOptions={avatarOptions} setAvatarOptions={setAvatarOptions}
        showAvatarBuilder={showAvatarBuilder} setShowAvatarBuilder={setShowAvatarBuilder}
        showContactProfile={showContactProfile} setShowContactProfile={setShowContactProfile}
        contactProfileContact={contactProfileContact}
        setContactProfileContact={setContactProfileContact}
        showStarredMsgs={showStarredMsgs} setShowStarredMsgs={setShowStarredMsgs}
        starredMsgs={starredMsgs} messages={messages}
        onJumpToMsg={handleJumpToMsg}
        onInitiateCall={initiateCall}
        onToggleConversationMute={() => toggleConversationMute(activeConv?.id)}
        onEnterMessageSelection={() => messageSelectionMode ? cancelMessageSelection() : enterMessageSelection()}
        onClearChat={() => activeConv && openClearConversationConfirm(activeConv)}
        onDeleteChat={() => activeConv && openDeleteConversationConfirm(activeConv)}
        onBlockContact={contact => setBlockingContact(contact)}
        onRemoveContact={removeContact}
        showChatSearch={showChatSearch}
        setShowChatSearch={setShowChatSearch}
        onOpenConversationSearch={(conversation) => {
          openConversation(conversation);
          setConversationPanelMode('search');
          setShowChatSearch(true);
        }}
        onOpenConversationStarred={(conversation) => {
          openConversation(conversation);
          setConversationPanelMode('starred');
          setShowChatSearch(true);
        }}
        conversationMuted={mutedConversationIds.includes(activeConv?.id)}
        messageSelectionMode={messageSelectionMode}
        activeConv={activeConv} getConvName={getConvName} getOtherUid={getOtherUid} getConvPhoto={getConvPhoto}
        newChatSheetInSidebar
        callSheetInSidebar
        showCallModal={showCallModal} setShowCallModal={setShowCallModal}
        callContact={callContact} callContactFromRecent={callContactFromRecent} getCallLog={getCallLog} refreshCallLog={refreshCallLog} clearCallLog={clearCallLog} callLogRateLimitUntil={callLogRateLimitUntil}
        showGroupInfo={showGroupInfo} setShowGroupInfo={setShowGroupInfo}
        addingMember={addingMember} setAddingMember={setAddingMember}
        groupPhotoLoading={groupPhotoLoading} uploadGroupPhoto={uploadGroupPhoto}
        removeMemberFromGroup={removeMemberFromGroup} addMemberToGroup={addMemberToGroup} renameGroup={renameGroup} promoteGroupAdmin={promoteGroupAdmin} relinquishGroupAdmin={relinquishGroupAdmin}
        activeCall={activeCall} setActiveCall={setActiveCall}
        unreadCounts={unreadCounts}
        forwardMsg={forwardMsg} setForwardMsg={setForwardMsg}
        conversations={conversations} forwardToConv={forwardToConv}
        errToast={errToast} dismissErrToast={() => setErrToast('')} mentionToast={mentionToast} dismissMentionToast={clearMentionToast} parentToast={parentToast} dismissParentToast={onDismissParentToast}
        onOpenMentionConversation={openConversation}
        blockedContacts={blockedContacts} parentBlockedUids={parentBlockedUids} unblockContact={unblockContact}
        callsAvailable={callsAvailable}
      />
      </Suspense>

      {deleteConfirm && (
        <PulseConfirmSheet
          title={deleteConfirm.count > 1 ? 'Berichten verwijderen' : 'Bericht verwijderen'}
          description={deleteConfirm.isOwn
            ? `Kies of je ${deleteConfirm.count > 1 ? 'deze berichten' : 'dit bericht'} alleen voor jezelf of voor iedereen wilt verwijderen.`
            : undefined}
          onClose={() => setDeleteConfirm(null)}
          actions={[
            {
              label: 'Voor mezelf verwijderen',
              tone: 'danger',
              icon: Delete,
              onSelect: async () => {
                for (const msgId of deleteConfirm.msgIds) {
                  // eslint-disable-next-line no-await-in-loop
                  await deleteMessage(msgId, 'self');
                }
                deleteConfirm.onComplete?.();
                setDeleteConfirm(null);
              },
            },
            deleteConfirm.isOwn && {
              label: 'Voor iedereen verwijderen',
              tone: 'danger',
              icon: Trash2,
              onSelect: async () => {
                  for (const msgId of deleteConfirm.msgIds) {
                    // eslint-disable-next-line no-await-in-loop
                    await deleteMessage(msgId, 'all');
                }
                deleteConfirm.onComplete?.();
                setDeleteConfirm(null);
              },
            },
          ]}
        />
      )}

      {blockingContact && (
        <BlockConfirmModal
          contactName={blockingContact.displayName || blockingContact.email || 'dit contact'}
          onConfirm={() => blockContact(blockingContact.uid)}
          onCancel={() => setBlockingContact(null)}
        />
      )}

      {contactSuccess && (
        <PulseConfirmSheet
          title="Gelukt"
          description={contactSuccess}
          tone="success"
          onClose={() => setContactSuccess('')}
          actions={[]}
        />
      )}

      {contextMenu && (
        <MsgContextMenu
          msg={contextMenu.msg}
          isOwn={contextMenu.isOwn}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          anchorRect={contextMenu.anchorRect}
          starred={starredMsgs.includes(contextMenu.msg.id)}
          pinned={pinnedMsgs[activeConv?.id]?.id === contextMenu.msg.id}
          onClose={() => setContextMenu(null)}
          onReply={() => { setReplyTo({ id: contextMenu.msg.id, text: contextMenu.msg.text, senderName: contextMenu.msg.senderName }); textareaRef.current?.focus(); }}
          onCopy={() => {
            copyTextToClipboard(contextMenu.msg.text || '')
              .then(() => showErrToast('📋 Bericht gekopieerd'))
              .catch((e) => {
                showErrToast('Kopieren lukt niet in deze browser.');
              });
          }}
          onReact={emoji => toggleReaction(contextMenu.msg.id, emoji)}
          onForward={() => setForwardMsg(contextMenu.msg)}
          onPin={() => handlePin(contextMenu.msg)}
          onStar={() => handleStar(contextMenu.msg.id)}
          onEdit={() => {
            if (!canEditMessage(contextMenu.msg)) {
              showErrToast(ENCRYPTED_EDIT_UNAVAILABLE_MESSAGE);
              return;
            }
            setEditingMsg({ id: contextMenu.msg.id, text: contextMenu.msg.text, protocol: contextMenu.msg.protocol });
            setText(contextMenu.msg.text);
            setTimeout(() => textareaRef.current?.focus(), 0);
          }}
          onDeleteRequest={() => handleDeleteRequest(contextMenu.msg)}
          onRetry={() => retryMessage(contextMenu.msg)}
        />
      )}
    </div>
  );
}
