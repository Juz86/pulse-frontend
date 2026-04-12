// src/screens/ChatScreen.js
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { canEditMessage, ENCRYPTED_EDIT_UNAVAILABLE_MESSAGE } from '../lib/e2ee/policy';
import { Bell, BellOff, Message, Delete, Trash2 } from '../components/Icons';
import ChatInput from '../components/ChatInput';
import ChatHeader from '../components/ChatHeader';
import ChatSidebar from '../components/ChatSidebar';
import MessageList from '../components/MessageList';
import MsgContextMenu from '../components/MsgContextMenu';
import BlockConfirmModal from '../components/BlockConfirmModal';
import useConversations from '../hooks/useConversations';
import useChat from '../hooks/useChat';
import useCalling from '../hooks/useCalling';
import useProfile from '../hooks/useProfile';
import useContacts from '../hooks/useContacts';
import { copyTextToClipboard } from '../utils';
import { isPulseWebBrowser } from '../lib/platform/runtime';

const ChatModals = lazy(() => import('../components/ChatModals'));

export default function ChatScreen({ user, onlineUsers = new Set(), inactiveUsers = new Set(), missedCallAlert, onCallLogRead, isParent, parentActivityBadge = 0, parentToast = null, onOpenDashboard, initialConvId = null, onConvIdHandled, serviceTransportReady = false }) {
  const callsAvailable = !isPulseWebBrowser();
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
  const [addingMember,   setAddingMember]   = useState(false);
  const [showContactProfile, setShowContactProfile] = useState(false);
  const [confirmDialog,  setConfirmDialog]  = useState(null);
  const [replyTo,        setReplyTo]        = useState(null);
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearch,     setChatSearch]     = useState('');
  const [chatSearchIdx,  setChatSearchIdx]  = useState(0);
  const [deleteMenuMsgId, setDeleteMenuMsgId] = useState(null);
  const [editingMsg,     setEditingMsg]     = useState(null);
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
  const [chatFading,     setChatFading]     = useState(false);
  const [contextMenu,    setContextMenu]    = useState(null); // { msg, isOwn, x, y }
  const [starredMsgs,    setStarredMsgs]    = useState(() => { try { return JSON.parse(localStorage.getItem(`pulse_starred_${user.uid}`) || '[]'); } catch { return []; } });
  const [pinnedMsgs,     setPinnedMsgs]     = useState(() => { try { return JSON.parse(localStorage.getItem(`pulse_pinned_msgs_${user.uid}`) || '{}'); } catch { return {}; } });
  const [deleteConfirm,  setDeleteConfirm]  = useState(null); // { msgId, isOwn }
  const [showStarredMsgs, setShowStarredMsgs] = useState(false);
  const [jumpToMsgId,     setJumpToMsgId]     = useState(null);
  const [isOnline,        setIsOnline]        = useState(navigator.onLine);
  const [conversationSelectionMode, setConversationSelectionMode] = useState(false);
  const [selectedConversationIds, setSelectedConversationIds] = useState([]);
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

  function showErrToast(msg) {
    setErrToast(msg);
    clearTimeout(errToastTimer.current);
    errToastTimer.current = setTimeout(() => setErrToast(''), 4000);
  }
  function toggleDnd() {
    const next = !dndRef.current;
    dndRef.current = next; setDnd(next);
    localStorage.setItem('pulse_dnd', next ? '1' : '0');
    showErrToast(next
      ? { icon: <BellOff size={15} aria-hidden="true" />, text: 'Meldingen uitgeschakeld', bg: 'rgba(80,80,100,0.92)' }
      : { icon: <Bell size={15} aria-hidden="true" />,    text: 'Meldingen ingeschakeld',  bg: 'rgba(34,197,94,0.92)' });
  }
  function handleShowContextMenu(e, msg) {
    e.preventDefault?.();
    setContextMenu({ msg, isOwn: msg.senderId === user.uid, x: e.clientX, y: e.clientY });
  }
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
    setDeleteConfirm({ msgId: msg.id, isOwn: msg.senderId === user.uid });
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
  function deleteSelectedConversations() {
    if (!selectedConversationIds.length) return;
    setConfirmDialog({
      message: `${selectedConversationIds.length} gesprek${selectedConversationIds.length === 1 ? '' : 'ken'} verwijderen?`,
      onConfirm: async () => {
        for (const convId of selectedConversationIds) {
          // eslint-disable-next-line no-await-in-loop
          await deleteConversation(null, convId);
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
    loadConversations, openConversation, deleteConversation, loadMoreMessages,
    sendMessage, stopTyping, retryMessage, retryAllFailed, toggleReaction,
    sendContactCardToConversation,
    forwardToConv, deleteMessage,
    toggleGroupMember, createGroup, addMemberToGroup, removeMemberFromGroup,
    storeTransientConversationMessage,
  } = useConversations({
    user, text, setText, setActiveTab, setShowChatSearch, setChatSearch,
    replyTo, setReplyTo, editingMsg, setEditingMsg,
    setReactionPickerMsgId, forwardMsg, setForwardMsg,
    pendingMentions, setPendingMentions, setMentionSuggestions,
    setUnreadCounts, convLabels, setConvLabels, setChatFading,
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
    contactRelation, setContactRelation, contactErr, contactLoading,
    showNewChat, setShowNewChat, searchEmail, setSearchEmail,
    searchResult, searchErr, friendReqSent, setFriendReqSent, friendReqLoading,
    pendingFriendRequest,
    sentFriendRequests, showFriendRequestsPanel, setShowFriendRequestsPanel,
    renamingContact, setRenamingContact, sharingContact, setSharingContact,
    shareRecipients, setShareRecipients, viewingSharedContact, setViewingSharedContact,
    viewingContact, setViewingContact, renameValue, setRenameValue,
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

  const { typing, typingName, pausedFeatures, mentionToast } = useChat({
    user, activeConvRef, conversationsRef, msgsAreaRef, dndRef, audioCtxRef,
    loadConversations, loadContacts, loadFriendRequests, setMessages, setConversations, setUnreadCounts,
    setFriendRequests, setContactSuccess, setShowFriendRequestsPanel, setContacts, setActiveConv,
    setBlockedContacts, setParentBlockedUids,
    onReconnect: retryAllFailed,
    onOpenMentionConversation: openConversation,
    onTransientMessage: storeTransientConversationMessage,
  });

  const { activeCall, setActiveCall, getCallLog, callContact, initiateCall, initiateCallFromConv } = useCalling({
    user, contacts, pausedFeatures, activeConvRef, msgsAreaRef,
    setMessages, loadConversations, findConvWithUid, setShowCallModal, showErrToast,
  });

  const {
    profileTab, setProfileTab, newName, setNewName, photoPreview, setPhotoPreview,
    profileLoading, profileMsg, setProfileMsg, newUsername, setNewUsername,
    usernameLoading, usernameMsg, newPassword, setNewPassword,
    confirmPassword, setConfirmPassword, showNewPassword, setShowNewPassword,
    passwordLoading, passwordMsg, chatBg, chatBgLoading, chatBgTab, setChatBgTab,
    chatBgMsg, showAvatarBuilder, setShowAvatarBuilder, avatarOptions, setAvatarOptions,
    groupPhotoLoading, historyRules, setHistoryRules,
    childHistoryRulesByUid, setChildHistoryRulesByUid,
    historyChildren, historySettingsLoading, historySettingsSavingTarget, historySettingsMsg,
    photoInputRef, bgInputRef, openProfile,
    handlePhotoChange, saveProfile, saveUsername, changePassword,
    uploadChatBgPhoto, saveChatBgColor, removeChatBg, uploadGroupPhoto, handleDeleteAccount,
    loadHistorySettings, saveHistorySettings, saveChildHistorySettings,
  } = useProfile({ user, activeConv, setActiveConv, setConversations, showErrToast, setConfirmDialog, isParent });

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
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
    const close = () => setReactionPickerMsgId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
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
  function getConvName(conv) {
    if (conv.isGroup) return conv.groupName || 'Groepsgesprek';
    const otherUid = conv.members?.find(m => m !== user.uid);
    const liveContact = contacts.find(c => c.uid === otherUid);
    return getContactDisplayName(liveContact || { uid: otherUid, displayName: conv.memberNames?.[otherUid] || '' }) || conv.memberNames?.[otherUid] || 'Contactpersoon';
  }
  function getOtherUid(conv) {
    if (conv?.isGroup) return null;
    return conv?.members?.find(m => m !== user.uid);
  }
  function getConvPhoto(conv) {
    if (conv.isGroup) return null;
    return contacts.find(c => c.uid === getOtherUid(conv))?.photoURL || null;
  }

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
        contactSuccess={contactSuccess}
        contacts={contacts} conversations={conversations}
        activeConv={activeConv} loadingConvs={loadingConvs}
        convLabels={convLabels} pinnedContacts={pinnedContacts}
        unreadCounts={unreadCounts} photoPreview={photoPreview}
        isParent={isParent} parentActivityBadge={parentActivityBadge}
        onOpenDashboard={onOpenDashboard}
        setLabelMenuConvId={() => {}}
        onNewChat={() => setShowNewChat(true)}
        onNewGroup={() => setShowNewGroup(true)}
        onShowCallModal={() => { setShowCallModal(true); setCallLogRead(true); onCallLogRead?.(); }}
        onShowAddContact={() => setShowAddContact(true)}
        onOpenProfile={() => { setShowProfile(true); openProfile(); }}
        setConfirmDialog={setConfirmDialog}
        onAcceptFriendRequest={acceptFriendRequest}
        onDeclineFriendRequest={declineFriendRequest}
        onRemindFriendRequest={remindFriendRequestById}
        onCancelFriendRequest={cancelFriendRequestById}
        onTogglePin={togglePin}
        onViewContact={contact => { setViewingContact(contact); setRenameValue(getContactNickname(contact.uid) || contact.displayName || ''); }}
        onStartChat={startChatWithContact} onCallContact={callContact}
        onRemoveContact={removeContact}
        onBlockContact={contact => setBlockingContact(contact)}
        onUnblockContact={unblockContact}
        blockedContacts={blockedContacts}
        parentBlockedUids={parentBlockedUids}
        onOpenConversation={openConversation}
        onCallFromConv={initiateCallFromConv} onDeleteConversation={deleteConversation}
        selectionMode={conversationSelectionMode}
        selectedConversationIds={selectedConversationIds}
        onToggleConversationSelection={toggleConversationSelection}
        onEnterConversationSelection={enterConversationSelection}
        onCancelConversationSelection={cancelConversationSelection}
        onDeleteSelectedConversations={deleteSelectedConversations}
        getConvName={getConvName} getOtherUid={getOtherUid} getConvPhoto={getConvPhoto}
        getContactDisplayName={getContactDisplayName}
        callsAvailable={callsAvailable}
      />

      <main className="chat-main" aria-label={activeConv ? `Chatvenster voor ${getConvName(activeConv)}` : 'Chatvenster'}>
        {!activeConv ? (
          <div className="empty-state" role="status" aria-live="polite" aria-labelledby="chat-empty-title" aria-describedby="chat-empty-description">
            <div className="empty-icon" aria-hidden="true"><Message size={48} /></div>
            <div className="empty-title" id="chat-empty-title">Kies een gesprek</div>
            <p id="chat-empty-description">Of klik op het <span aria-hidden="true"><Message size={14} style={{ verticalAlign: 'middle', margin: '0 2px', color: '#fff' }} /></span> om een nieuwe chat te beginnen.</p>
          </div>
        ) : (
          <>
            <ChatHeader
              activeConv={activeConv} onlineUsers={onlineUsers} inactiveUsers={inactiveUsers}
              typing={typing} typingName={typingName} unreadCounts={unreadCounts}
              onBack={() => setActiveConv(null)} onInitiateCall={initiateCall}
              onShowGroupInfo={() => setShowGroupInfo(true)}
              onShowContactProfile={() => setShowContactProfile(true)}
              parentBlockedOtherUid={!activeConv?.isGroup && parentBlockedUids.includes(getOtherUid(activeConv))}

              setRenameValue={setRenameValue}
              getConvName={getConvName} getOtherUid={getOtherUid} getConvPhoto={getConvPhoto}
              getContactNickname={getContactNickname}
              showChatSearch={showChatSearch} setShowChatSearch={setShowChatSearch}
              chatSearch={chatSearch} setChatSearch={setChatSearch}
              chatSearchIdx={chatSearchIdx} setChatSearchIdx={setChatSearchIdx}
              messages={messages} chatSearchRef={chatSearchRef}
              serviceTransportReady={serviceTransportReady}
              callsAvailable={callsAvailable}
            />
            {!isOnline && (
              <div className="offline-banner" role="status" aria-live="polite">
                Je bent offline. Berichten worden verstuurd zodra je weer verbinding hebt.
              </div>
            )}
            {pinnedMsgs[activeConv?.id] && (
              <div className="pinned-msg-bar" role="status" aria-live="polite">
                <span className="pinned-msg-icon" aria-hidden="true">📌</span>
                <div className="pinned-msg-text">{pinnedMsgs[activeConv.id].text}</div>
                <button type="button" className="pinned-msg-close" aria-label="Losmaken" onClick={() => handlePin(pinnedMsgs[activeConv.id])}><span aria-hidden="true">✕</span></button>
              </div>
            )}
            {(() => {
              const blockedOtherUid = !activeConv.isGroup && getOtherUid(activeConv);
              const isBlockedConv   = blockedOtherUid && blockedContacts.some(c => c.uid === blockedOtherUid);
              const isParentBlocked = blockedOtherUid && parentBlockedUids.includes(blockedOtherUid);
              const blockedName     = isBlockedConv && !isParentBlocked && (blockedContacts.find(c => c.uid === blockedOtherUid)?.displayName || getConvName(activeConv));
              if (!isBlockedConv || isParentBlocked) return null;
              return (
                <div className="blocked-conv-banner" role="status">
                  <span>Je hebt <strong>{blockedName}</strong> geblokkeerd. Ze kunnen je niet meer berichten of bellen.</span>
                  <button type="button" className="btn-secondary" style={{ fontSize: '13px', padding: '6px 14px' }} onClick={() => unblockContact(blockedOtherUid)}>Deblokkeren</button>
                </div>
              );
            })()}
            <MessageList
              user={user}
              messages={messages.filter(m => !blockedContacts.some(c => c.uid === m.senderId && m.senderId !== user.uid))}
              activeConv={activeConv} currentUid={user.uid}
              chatSearch={chatSearch} chatSearchIdx={chatSearchIdx}
              chatBg={chatBg} chatFading={chatFading}
              hasMore={hasMore} loadingMore={loadingMore} loadingMsgs={loadingMsgs}
              showChatSearch={showChatSearch} msgsAreaRef={msgsAreaRef} msgEndRef={msgEndRef}
              onLoadMore={loadMoreMessages}
              onCloseSearch={() => { setShowChatSearch(false); setChatSearch(''); }}
              onReact={(msgId, emoji) => toggleReaction(msgId, emoji)}
              onShowContextMenu={handleShowContextMenu}
              jumpToMsgId={jumpToMsgId}
              onRetry={msg => retryMessage(msg)}
              onStartCall={callsAvailable ? ({ toUid, convId, name, isVideo }) => initiateCallFromConv({ id: convId, members: [user.uid, toUid], memberNames: { [toUid]: name } }, isVideo) : undefined}
              onViewContact={sc => { setFriendReqSent(false); setViewingSharedContact({ ...sc, isAlreadyContact: contacts.some(c => c.uid === sc?.uid) }); }}
            />
            {(() => {
              const blockedOtherUid = !activeConv.isGroup && getOtherUid(activeConv);
              const isBlockedConv   = blockedOtherUid && blockedContacts.some(c => c.uid === blockedOtherUid);
              const isParentBlocked = blockedOtherUid && parentBlockedUids.includes(blockedOtherUid);
              return isBlockedConv ? (
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

      <Suspense fallback={null}>
      <ChatModals
        renamingContact={renamingContact} setRenamingContact={setRenamingContact}
        renameValue={renameValue} setRenameValue={setRenameValue}
        saveContactNickname={saveContactNickname} setContacts={setContacts}
        sharingContact={sharingContact} setSharingContact={setSharingContact}
        shareRecipients={shareRecipients} setShareRecipients={setShareRecipients}
        contacts={contacts} sendContactCard={sendContactCard}
        getContactDisplayName={getContactDisplayName}
        viewingSharedContact={viewingSharedContact} setViewingSharedContact={setViewingSharedContact}
        onlineUsers={onlineUsers} inactiveUsers={inactiveUsers}
        friendReqLoading={friendReqLoading} friendReqSent={friendReqSent}
        sendFriendRequestToEmail={sendFriendRequestToEmail}
        viewingContact={viewingContact} setViewingContact={setViewingContact}
        findConvWithUid={findConvWithUid} setConvLabel={setConvLabel} convLabels={convLabels}
        getContactNickname={getContactNickname}
        confirmDialog={confirmDialog} setConfirmDialog={setConfirmDialog}
        showAddContact={showAddContact} setShowAddContact={setShowAddContact}
        contactEmail={contactEmail} setContactEmail={setContactEmail}
        contactNickname={contactNickname} setContactNickname={setContactNickname}
        contactRelation={contactRelation} setContactRelation={setContactRelation}
        contactErr={contactErr} contactLoading={contactLoading} addContact={addContact}
        pendingFriendRequest={pendingFriendRequest}
        remindPendingFriendRequest={remindPendingFriendRequest}
        cancelPendingFriendRequest={cancelPendingFriendRequest}
        clearPendingFriendRequestState={clearPendingFriendRequestState}
        friendRequests={friendRequests}
        sentFriendRequests={sentFriendRequests}
        showFriendRequestsPanel={showFriendRequestsPanel} setShowFriendRequestsPanel={setShowFriendRequestsPanel}
        onAcceptFriendRequest={acceptFriendRequest}
        onDeclineFriendRequest={declineFriendRequest}
        onRemindFriendRequest={remindFriendRequestById}
        onCancelFriendRequest={cancelFriendRequestById}
        showNewChat={showNewChat} setShowNewChat={setShowNewChat}
        searchEmail={searchEmail} setSearchEmail={setSearchEmail}
        searchErr={searchErr} searchResult={searchResult}
        searchUser={searchUser} startConversationWith={startConversationWith}
        showNewGroup={showNewGroup} setShowNewGroup={setShowNewGroup}
        groupName={groupName} setGroupName={setGroupName}
        groupMembers={groupMembers} toggleGroupMember={toggleGroupMember} createGroup={createGroup}
        showProfile={showProfile} setShowProfile={setShowProfile}
        profileTab={profileTab} setProfileTab={setProfileTab}
        photoPreview={photoPreview} setPhotoPreview={setPhotoPreview}
        newName={newName} setNewName={setNewName}
        newUsername={newUsername} setNewUsername={setNewUsername}
        isParent={isParent} user={user}
        showNewPassword={showNewPassword} setShowNewPassword={setShowNewPassword}
        newPassword={newPassword} setNewPassword={setNewPassword}
        confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
        passwordLoading={passwordLoading} passwordMsg={passwordMsg}
        profileMsg={profileMsg} setProfileMsg={setProfileMsg} profileLoading={profileLoading}
        usernameLoading={usernameLoading} usernameMsg={usernameMsg}
        historyRules={historyRules} setHistoryRules={setHistoryRules}
        childHistoryRulesByUid={childHistoryRulesByUid} setChildHistoryRulesByUid={setChildHistoryRulesByUid}
        historyChildren={historyChildren}
        historySettingsLoading={historySettingsLoading}
        historySettingsSavingTarget={historySettingsSavingTarget}
        historySettingsMsg={historySettingsMsg}
        chatBgTab={chatBgTab} setChatBgTab={setChatBgTab}
        chatBgMsg={chatBgMsg} chatBg={chatBg} chatBgLoading={chatBgLoading}
        saveProfile={saveProfile} saveUsername={saveUsername} changePassword={changePassword}
        loadHistorySettings={loadHistorySettings} saveHistorySettings={saveHistorySettings} saveChildHistorySettings={saveChildHistorySettings}
        uploadChatBgPhoto={uploadChatBgPhoto} saveChatBgColor={saveChatBgColor} removeChatBg={removeChatBg}
        handlePhotoChange={handlePhotoChange} handleDeleteAccount={handleDeleteAccount}
        photoInputRef={photoInputRef} bgInputRef={bgInputRef}
        avatarOptions={avatarOptions} setAvatarOptions={setAvatarOptions}
        showAvatarBuilder={showAvatarBuilder} setShowAvatarBuilder={setShowAvatarBuilder}
        showContactProfile={showContactProfile} setShowContactProfile={setShowContactProfile}
        showStarredMsgs={showStarredMsgs} setShowStarredMsgs={setShowStarredMsgs}
        starredMsgs={starredMsgs} messages={messages}
        onJumpToMsg={handleJumpToMsg}
        activeConv={activeConv} getConvName={getConvName} getOtherUid={getOtherUid} getConvPhoto={getConvPhoto}
        showCallModal={showCallModal} setShowCallModal={setShowCallModal}
        callContact={callContact} getCallLog={getCallLog}
        showGroupInfo={showGroupInfo} setShowGroupInfo={setShowGroupInfo}
        addingMember={addingMember} setAddingMember={setAddingMember}
        groupPhotoLoading={groupPhotoLoading} uploadGroupPhoto={uploadGroupPhoto}
        removeMemberFromGroup={removeMemberFromGroup} addMemberToGroup={addMemberToGroup}
        activeCall={activeCall} setActiveCall={setActiveCall}
        forwardMsg={forwardMsg} setForwardMsg={setForwardMsg}
        conversations={conversations} forwardToConv={forwardToConv}
        errToast={errToast} mentionToast={mentionToast} parentToast={parentToast}
        onOpenMentionConversation={openConversation}
        blockedContacts={blockedContacts} parentBlockedUids={parentBlockedUids} unblockContact={unblockContact}
        callsAvailable={callsAvailable}
      />
      </Suspense>

      {deleteConfirm && (
        <div className="delete-popup-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="delete-popup" role="dialog" aria-modal="true" aria-labelledby="delete-popup-title" aria-describedby="delete-popup-description" onClick={e => e.stopPropagation()}>
            <div className="delete-popup-title" id="delete-popup-title">Bericht verwijderen</div>
            <p id="delete-popup-description" style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text3)' }}>
              Kies of je dit bericht alleen voor jezelf of voor iedereen wilt verwijderen.
            </p>
            <button type="button" className="delete-popup-btn" onClick={() => { deleteMessage(deleteConfirm.msgId, 'self'); setDeleteConfirm(null); }}>
              <Delete size={18} aria-hidden="true" /> Voor mezelf verwijderen
            </button>
            {deleteConfirm.isOwn && (
              <button type="button" className="delete-popup-btn danger" onClick={() => { deleteMessage(deleteConfirm.msgId, 'all'); setDeleteConfirm(null); }}>
                <Trash2 size={18} aria-hidden="true" /> Voor iedereen verwijderen
              </button>
            )}
            <button type="button" className="delete-popup-cancel" onClick={() => setDeleteConfirm(null)}>Annuleren</button>
          </div>
        </div>
      )}

      {blockingContact && (
        <BlockConfirmModal
          contactName={blockingContact.displayName || blockingContact.email || 'dit contact'}
          onConfirm={() => blockContact(blockingContact.uid)}
          onCancel={() => setBlockingContact(null)}
        />
      )}

      {contextMenu && (
        <MsgContextMenu
          msg={contextMenu.msg}
          isOwn={contextMenu.isOwn}
          position={{ x: contextMenu.x, y: contextMenu.y }}
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
          onForward={() => setForwardMsg({ text: contextMenu.msg.text })}
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
