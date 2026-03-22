// src/screens/ChatScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '../services/socket';
import { Bell, BellOff, Message } from '../components/Icons';
import ChatInput from '../components/ChatInput';
import ChatHeader from '../components/ChatHeader';
import ChatSidebar from '../components/ChatSidebar';
import ChatModals from '../components/ChatModals';
import MessageList from '../components/MessageList';
import useConversations from '../hooks/useConversations';
import useChat from '../hooks/useChat';
import useCalling from '../hooks/useCalling';
import useProfile from '../hooks/useProfile';
import useContacts from '../hooks/useContacts';

export default function ChatScreen({ user, onlineUsers = new Set(), inactiveUsers = new Set(), lightMode, onToggleTheme, missedCallAlert, onCallLogRead, isParent, parentActivityBadge = 0, parentToast = null, onOpenDashboard, initialConvId = null, onConvIdHandled }) {
  // ── UI state ──────────────────────────────────────────────────────────────
  const [text,           setText]           = useState('');
  const [unreadCounts,   setUnreadCounts]   = useState({});
  const [activeTab,      setActiveTab]      = useState('chats');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [chatFilter,     setChatFilter]     = useState('all');
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [convLabels,     setConvLabels]     = useState(() => { try { return JSON.parse(localStorage.getItem(`pulse_labels_${user.uid}`) || '{}'); } catch { return {}; } });
  const [labelMenuConvId, setLabelMenuConvId] = useState(null);
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
      ? { icon: <BellOff size={15}/>, text: 'Meldingen uitgeschakeld', bg: 'rgba(80,80,100,0.92)' }
      : { icon: <Bell size={15}/>,    text: 'Meldingen ingeschakeld',  bg: 'rgba(34,197,94,0.92)' });
  }
  const setConvLabel = (convId, label) => {
    const next = label ? { ...convLabels, [convId]: label } : Object.fromEntries(Object.entries(convLabels).filter(([k]) => k !== convId));
    setConvLabels(next);
    localStorage.setItem(`pulse_labels_${user.uid}`, JSON.stringify(next));
    setLabelMenuConvId(null);
  };

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const {
    conversations, setConversations, activeConv, setActiveConv,
    messages, setMessages, loadingConvs, loadingMsgs, hasMore, loadingMore,
    loadConversations, openConversation, deleteConversation, loadMoreMessages,
    sendMessage, sendEditedMessage, stopTyping, retryMessage, toggleReaction,
    forwardToConv, deleteMessage,
    toggleGroupMember, createGroup, addMemberToGroup, removeMemberFromGroup,
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
  });

  const {
    contacts, setContacts, pinnedContacts, friendRequests, setFriendRequests,
    contactSuccess, setContactSuccess, showAddContact, setShowAddContact,
    contactEmail, setContactEmail, contactNickname, setContactNickname,
    contactRelation, setContactRelation, contactErr, contactLoading,
    showNewChat, setShowNewChat, searchEmail, setSearchEmail,
    searchResult, searchErr, friendReqSent, setFriendReqSent, friendReqLoading,
    renamingContact, setRenamingContact, sharingContact, setSharingContact,
    shareRecipients, setShareRecipients, viewingSharedContact, setViewingSharedContact,
    viewingContact, setViewingContact, renameValue, setRenameValue,
    loadContacts, loadFriendRequests,
    getContactNickname, saveContactNickname, getContactDisplayName, findConvWithUid,
    addContact, sendFriendRequestToEmail, acceptFriendRequest, declineFriendRequest,
    removeContact, togglePin, startChatWithContact, searchUser, startConversationWith,
  } = useContacts({
    user, conversations, setConversations, activeConv, setActiveConv,
    setMessages, setConvLabels, openConversation, loadConversations,
    showErrToast, setConfirmDialog,
  });

  const { connected, reconnectIn, typing, typingName, pausedFeatures, mentionToast } = useChat({
    user, activeConvRef, conversationsRef, msgsAreaRef, dndRef, audioCtxRef,
    loadConversations, loadContacts, setMessages, setConversations, setUnreadCounts,
    setFriendRequests, setContactSuccess, setContacts, setActiveConv,
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
    groupPhotoLoading, photoInputRef, bgInputRef, openProfile,
    handlePhotoChange, saveProfile, saveUsername, changePassword,
    uploadChatBgPhoto, saveChatBgColor, removeChatBg, uploadGroupPhoto, handleDeleteAccount,
  } = useProfile({ user, activeConv, setActiveConv, setConversations, showErrToast, setConfirmDialog });

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => () => clearTimeout(typingTimer.current), []);
  useEffect(() => {
    if (!initialConvId || !conversations.length) return;
    const conv = conversations.find(c => c.id === initialConvId);
    if (conv) { openConversation(conv); onConvIdHandled?.(); }
  }, [initialConvId, conversations.length]);
  useEffect(() => { loadConversations(); loadContacts(); loadFriendRequests(); }, [loadConversations, loadContacts, loadFriendRequests]);
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
  }, [showAddContact, showNewChat, showNewGroup, showProfile, showCallModal, showGroupInfo]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function sendContactCard(toContact, sharedContact) {
    const conv = findConvWithUid(toContact.uid);
    const socket = getSocket();
    if (!conv || !socket) return;
    socket.emit('conversation:join', { convId: conv.id });
    socket.emit('message:send', { convId: conv.id, message: {
      convId: conv.id, senderId: user.uid, senderName: user.displayName || user.email,
      type: 'contact', sharedContact: { uid: sharedContact.uid, name: getContactDisplayName(sharedContact), email: sharedContact.email || '' },
      createdAt: new Date().toISOString(),
    }});
    setSharingContact(null);
  }
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
    return contacts.find(c => c.uid === getOtherUid(conv))?.photoURL || null;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app-screen">
      {!connected && (
        <div className="connection-banner">
          <span>Verbinding verbroken{reconnectIn ? ` — opnieuw verbinden in ${reconnectIn}s` : ' — verbinden\u2026'}</span>
          <button className="connection-retry-btn" onClick={() => { const s = getSocket(); s?.connect(); }}>Nu verbinden</button>
        </div>
      )}

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
        friendRequests={friendRequests} contactSuccess={contactSuccess}
        contacts={contacts} conversations={conversations}
        activeConv={activeConv} loadingConvs={loadingConvs}
        convLabels={convLabels} pinnedContacts={pinnedContacts}
        unreadCounts={unreadCounts} photoPreview={photoPreview}
        isParent={isParent} parentActivityBadge={parentActivityBadge}
        lightMode={lightMode} onToggleTheme={onToggleTheme}
        onOpenDashboard={onOpenDashboard}
        setLabelMenuConvId={setLabelMenuConvId}
        onNewChat={() => setShowNewChat(true)}
        onNewGroup={() => setShowNewGroup(true)}
        onShowCallModal={() => { setShowCallModal(true); setCallLogRead(true); onCallLogRead?.(); }}
        onShowAddContact={() => setShowAddContact(true)}
        onOpenProfile={() => { setShowProfile(true); openProfile(); }}
        onAcceptFriendRequest={acceptFriendRequest}
        onDeclineFriendRequest={declineFriendRequest}
        onTogglePin={togglePin}
        onViewContact={contact => { setViewingContact(contact); setRenameValue(getContactNickname(contact.uid) || contact.displayName || ''); }}
        onStartChat={startChatWithContact} onCallContact={callContact}
        onRemoveContact={removeContact} onOpenConversation={openConversation}
        onCallFromConv={initiateCallFromConv} onDeleteConversation={deleteConversation}
        getConvName={getConvName} getOtherUid={getOtherUid} getConvPhoto={getConvPhoto}
        getContactDisplayName={getContactDisplayName}
      />

      <main className="chat-main">
        {!activeConv ? (
          <div className="empty-state">
            <div className="empty-icon"><Message size={48} /></div>
            <div className="empty-title">Kies een gesprek</div>
            <p>Of klik op het <Message size={14} style={{ verticalAlign: 'middle', margin: '0 2px', color: '#fff' }} /> om een nieuwe chat te beginnen.</p>
          </div>
        ) : (
          <>
            <ChatHeader
              activeConv={activeConv} onlineUsers={onlineUsers} inactiveUsers={inactiveUsers}
              typing={typing} typingName={typingName} unreadCounts={unreadCounts}
              onBack={() => setActiveConv(null)} onInitiateCall={initiateCall}
              onShowGroupInfo={() => setShowGroupInfo(true)}
              onShowContactProfile={() => setShowContactProfile(true)}
              setRenameValue={setRenameValue}
              getConvName={getConvName} getOtherUid={getOtherUid} getConvPhoto={getConvPhoto}
              getContactNickname={getContactNickname}
              showChatSearch={showChatSearch} setShowChatSearch={setShowChatSearch}
              chatSearch={chatSearch} setChatSearch={setChatSearch}
              chatSearchIdx={chatSearchIdx} setChatSearchIdx={setChatSearchIdx}
              messages={messages} chatSearchRef={chatSearchRef}
            />
            <MessageList
              messages={messages} activeConv={activeConv} currentUid={user.uid}
              chatSearch={chatSearch} chatSearchIdx={chatSearchIdx}
              chatBg={chatBg} chatFading={chatFading}
              hasMore={hasMore} loadingMore={loadingMore} loadingMsgs={loadingMsgs}
              deleteMenuMsgId={deleteMenuMsgId} reactionPickerMsgId={reactionPickerMsgId}
              showChatSearch={showChatSearch} msgsAreaRef={msgsAreaRef} msgEndRef={msgEndRef}
              onLoadMore={loadMoreMessages}
              onCloseSearch={() => { setShowChatSearch(false); setChatSearch(''); }}
              onToggleDeleteMenu={id => setDeleteMenuMsgId(prev => prev === id ? null : id)}
              onToggleReactionPicker={id => setReactionPickerMsgId(prev => prev === id ? null : id)}
              onReact={(msgId, emoji) => toggleReaction(msgId, emoji)}
              onReply={msg => { setReplyTo({ id: msg.id, text: msg.text, senderName: msg.senderName }); textareaRef.current?.focus(); }}
              onEdit={msg => { setEditingMsg({ id: msg.id, text: msg.text }); setText(msg.text); setDeleteMenuMsgId(null); setTimeout(() => textareaRef.current?.focus(), 0); }}
              onForward={msg => { setForwardMsg({ text: msg.text }); setDeleteMenuMsgId(null); }}
              onCopy={msg => { navigator.clipboard.writeText(msg.text || '').then(() => showErrToast('\uD83D\uDCCB Bericht gekopieerd')).catch(e => { console.warn('[Pulse] Fout:', e.message); }); setDeleteMenuMsgId(null); }}
              onDeleteSelf={msgId => deleteMessage(msgId, 'self')}
              onDeleteAll={msgId => deleteMessage(msgId, 'all')}
              onRetry={msg => retryMessage(msg)}
              onViewContact={sc => { setFriendReqSent(false); setViewingSharedContact({ ...sc, isAlreadyContact: contacts.some(c => c.uid === sc?.uid) }); }}
            />
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
          </>
        )}
      </main>

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
        chatBgTab={chatBgTab} setChatBgTab={setChatBgTab}
        chatBgMsg={chatBgMsg} chatBg={chatBg} chatBgLoading={chatBgLoading}
        saveProfile={saveProfile} saveUsername={saveUsername} changePassword={changePassword}
        uploadChatBgPhoto={uploadChatBgPhoto} saveChatBgColor={saveChatBgColor} removeChatBg={removeChatBg}
        handlePhotoChange={handlePhotoChange} handleDeleteAccount={handleDeleteAccount}
        photoInputRef={photoInputRef} bgInputRef={bgInputRef}
        avatarOptions={avatarOptions} setAvatarOptions={setAvatarOptions}
        showAvatarBuilder={showAvatarBuilder} setShowAvatarBuilder={setShowAvatarBuilder}
        showContactProfile={showContactProfile} setShowContactProfile={setShowContactProfile}
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
        lightMode={lightMode}
      />
    </div>
  );
}
