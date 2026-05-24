# Functions Overview (pulse-frontend)

Generated: 2026-05-24T09:08:34.992Z

- Files with detected functions: **98**
- Total detected named functions: **809**

## scripts/deploy-pages.js
- run

## scripts/verify-deployed-targets.js
- fetchResponse
- getRemediationHints
- getSelectedTargets
- main
- parseHttpsUrl
- verifyTarget
- verifyTargets
- websocketOriginFromUrl

## scripts/verify-deployed-targets.test.js
- createFetcher

## scripts/verify-landing-build.js
- collectJsFiles

## scripts/verify-public-headers.js
- websocketOriginFromUrl

## scripts/verify-target-headers.js
- websocketOriginFromUrl

## scripts/write-target-headers.js
- originFromUrl
- replaceAll
- trimTrailingSlash
- websocketOriginFromUrl
- writeTargetCrawlerFiles
- writeTargetMetadata

## src/App.js
- App
- attachUpdateListener
- checkUpdate
- distanceInMeters
- handleAuthRequest
- handler
- isTextEditingElement
- MainApp
- MarketingRoute
- normalizeLocationErrorCode
- onIncomingCall
- onVisibilityRefresh
- openAuth
- openIncomingCallFromPayload
- openParentAuth
- persistLocationState
- refreshServiceTransportReady
- rehydrateIncomingCall
- toRad
- unsub
- update
- WebAppLoginShell

## src/components/AttachmentMessageCard.js
- AttachmentMessageBody
- AttachmentMessageCard

## src/components/AuthModal.js
- AuthModal
- handleBackdrop
- onKey

## src/components/AvatarBuilder.js
- AvatarBuilder
- buildAvatarSvg
- handleSave
- randomFrom
- svgToPng

## src/components/BlockConfirmModal.js
- BlockConfirmModal

## src/components/CallMessageCard.js
- CallMessageCard

## src/components/callMessageHelpers.js
- buildCallMessageCardPresentation
- deriveCallMessagePresentation

## src/components/CallOverlay.js
- CallOverlay
- CameraRotateIcon
- formatTimer
- handleAccept
- handleAcceptVideoUpgrade
- handleDecline
- handleEnd
- handleOpenChat
- handleOverlayClose
- handleSelectParticipant
- handleSwitchCamera
- handleUpgradeToVideo
- MutedMicIcon
- onBeforeUnload
- onOffline
- onOnline
- onPageHide
- onPopState
- ring
- startTimer
- syncAudio
- toggleCam
- toggleMute
- toggleSpeakerMode

## src/components/ChatHeader.js
- ChatHeader
- closeChatSearch
- closeMoreActions
- handleClickOutside
- handleProfileKeyDown
- openChatSearch
- openContactProfile
- openHeaderDetails
- toggleChatSearch
- updateMenuPosition

## src/components/ChatInput.js
- ChatInput

## src/components/ChatModals.js
- ChatModals
- getFocusable
- getFriendRequestId
- handleEscape
- handleLogoutFromSettings
- handlePointerDown
- HistorySelect
- onKeyDown
- onVisibilityChange
- openStarredFromProfile
- startPolling
- stopPolling

## src/components/ChatSidebar.js
- ChatSidebar
- handleClickOutside
- handleOpenConversation
- onKeyDown
- onPopState
- openContactMenu

## src/components/ConversationItem.js
- closeSwipe
- ConversationItemBase
- handleKeyDown
- handleOpen
- onPointerCancel
- onPointerDown
- onPointerMove
- onPointerUp

## src/components/ConversationList.js
- ConversationList
- handlePointerDownOutside

## src/components/DecorativeAvatars.js
- DecorativeAvatar
- makeAvatar

## src/components/LegalPageLayout.js
- handler
- LegalPageLayout

## src/components/MarketingFooter.js
- MarketingFooter

## src/components/MarketingNavbar.js
- handleClickOutside
- handleKeyDown
- handleResize
- MarketingNavbar
- openParentLogin

## src/components/MessageBubble.js
- MessageBubble

## src/components/MessageBubbleActions.js
- closeOnEscape
- closeOnOutsidePointerDown
- closeOnScroll
- MessageBubbleActions

## src/components/messageBubbleCardHelpers.js
- buildAttachmentMessageRuntimeInput
- buildMessageBubbleCard
- buildMessageBubbleContext
- buildMessageBubbleHandlers
- buildMessageBubbleRenderInput
- resolveMessageBubbleCardBuilder
- withMessageCreatedAt

## src/components/messageBubbleCardRendererHelpers.js
- buildAttachmentMessageCardRenderConfig
- buildAttachmentMessageCardRenderProps
- buildCallMessageCardRenderConfig
- buildCallMessageCardRenderProps
- buildContactMessageCardRenderConfig
- buildContactMessageCardRenderProps
- buildGroupedPresentationCardRenderConfig
- buildMessageBubbleCardOutputState
- buildMessageBubbleCardRenderConfig
- buildMessageBubbleCardRenderResult
- buildMessageBubbleRenderRuntime
- buildPresentationCardRenderConfig
- buildResolvedMessageBubbleRenderState
- buildSystemMessageCardRenderConfig
- buildSystemMessageCardRenderProps
- buildTextMessageCardRenderConfig
- buildTextMessageCardRenderProps
- renderDirectMessageBubbleCardOutput
- renderGroupedMessageBubbleCardOutput
- renderMessageBubbleCard
- renderMessageBubbleCardContent
- renderMessageBubbleCardOutput
- resolveMessageBubbleCardOutputRenderer
- resolveMessageBubbleRenderConfigBuilder
- shouldSkipMessageBubbleCardRender

## src/components/MessageBubbleGroup.js
- MessageBubbleGroup

## src/components/messageBubbleHelpers.js
- buildSharedContactMessageCardPresentation
- buildStandardMessageBubblePresentation
- buildTextMessageCardPresentation
- getMessageReceiptSummaryLabel
- getMessageStatusInfo
- highlightMessageSearch
- renderMessageTextWithMentions

## src/components/MessageList.js
- MessageList
- MessageListRow
- NOOP

## src/components/MessageReactionBar.js
- closeOnEscape
- closeOnOutsideClick
- closeOnScroll
- findContactForUid
- getContactUid
- handleReactFromDetails
- MessageReactionBar
- openDetails
- resolveReactionPerson
- rowContent

## src/components/MsgContextMenu.js
- doAndClose
- handleKeyDown
- handleReact
- MsgContextMenu

## src/components/PageMeta.js
- PageMeta
- resolveCanonical
- upsertMeta

## src/components/ParentAuthModal.js
- handleBackdrop
- onKey
- ParentAuthModal

## src/components/PulseLogo.js
- PulseLogo

## src/components/SafeSvgImage.js
- SafeSvgImage

## src/components/SharedContactMessageCard.js
- SharedContactMessageCard

## src/components/StandardMessageBubble.js
- StandardMessageBubble

## src/components/SystemMessageNote.js
- SystemMessageNote

## src/components/TextMessageCard.js
- handleMenuClick
- TextMessageCard

## src/components/useAttachmentMessageRuntime.js
- useAttachmentMessageRuntime

## src/components/useMessageBubbleInteractions.js
- clearLongPressTimer
- handleActionCardKeyDown
- handleContextMenu
- handleTouchCancel
- handleTouchEnd
- handleTouchMove
- handleTouchStart
- useMessageBubbleInteractions

## src/components/UserAvatar.js
- UserAvatar

## src/config/appConfig.js
- getAppLoginUrl
- getCanonicalUrl

## src/config/runtimeConfig.js
- getDefaultApiUrl
- getDefaultMarketingUrl
- getDefaultWebOrigin
- getRuntimeOrigin
- getWindowLocation
- getWindowOrigin
- hostnameFromUrl
- isLocalApiUrl
- isLocalHost
- isNativeRuntime
- shouldUseLocalRuntimeFallback
- trimTrailingSlash

## src/firebase.js
- messaging

## src/hooks/useCalling.js
- callContact
- callContactFromRecent
- ensureDirectConversationForCall
- getCallLog
- initiateCall
- initiateCallFromConv
- mergeCallLogs
- onRealtimeMessage
- run
- sendCallMessage
- startCallTo
- useCalling
- writeLegacyCallEntry

## src/hooks/useChat.js
- buildIncomingEventKey
- isConversationMuted
- markIncomingEventProcessed
- onAccountPaused
- onAccountResumed
- onActivity
- onConnect
- onContactBlockedByParent
- onContactRemovedByParent
- onContactUnblockedByParent
- onConversationCreated
- onConversationHardCleared
- onConversationMemberAdded
- onConversationMemberRemoved
- onDisconnect
- onFriendAccepted
- onFriendRequest
- onFriendRequestCancelled
- onMentionNotify
- onMessageDeleted
- onMessageEdited
- onMessageReaction
- onMessageReceived
- onMessageStatus
- onTypingUpdate
- onUserUpdated
- playMessageSound
- useChat

## src/hooks/useContacts.js
- acceptFriendRequest
- addContact
- blockContact
- cancelFriendRequestById
- cancelPendingFriendRequest
- clearPendingFriendRequestState
- declineFriendRequest
- findConvWithUid
- getContactDisplayName
- getContactNickname
- getFriendRequestId
- pending
- remindFriendRequestById
- remindPendingFriendRequest
- removeContact
- resolveIdentifierToEmail
- run
- saveContactNickname
- searchUser
- sendFriendRequestToEmail
- startChatWithContact
- startConversationWith
- togglePin
- unblockContact
- useContacts

## src/hooks/useConversations.js
- addMemberToGroup
- clearConversationHistoryHard
- createGroup
- deleteConversation
- deleteMessage
- fetchConversationMessages
- forwardToConv
- getConversationRecipients
- getSessionMessagesForConversation
- hardDeleteConversation
- hydrateMessages
- leaveGroup
- loadMoreMessages
- markConversationMessagesAsRead
- mergeConversationMessages
- openConversation
- patchMessageAsFailed
- patchMessageAsSending
- patchMessageAsSent
- performDelete
- performLeave
- persistSessionConversationState
- removeMemberFromGroup
- removePending
- resetComposer
- resolvePendingMessageProtocol
- retryAllFailed
- retryMessage
- run
- savePending
- sendContactCardToConversation
- sendEditedMessage
- sendMessage
- sendPreparedMessage
- sendViaService
- setSessionMessagesForConversation
- shouldUseServiceTransport
- stopTyping
- stored
- storeTransientConversationMessage
- syncConversationCache
- toggleGroupMember
- toggleReaction
- useConversations

## src/hooks/useMarketingAuth.js
- openLogin
- openParentSignup
- openWebAppInNewTab
- useMarketingAuth

## src/hooks/useProfile.js
- authFetch
- changePassword
- dataURLtoBlob
- handleDeleteAccount
- handlePhotoChange
- loadHistorySettings
- openProfile
- removeChatBg
- resizeImageToBase64
- saveChatBgColor
- saveChildHistorySettings
- saveHistorySettings
- saveProfile
- saveUsername
- uploadChatBgPhoto
- uploadGroupPhoto
- useProfile

## src/index.js
- AppCrashFallback
- isChunkLoadFailure
- reloadOnceForFreshAssets
- renderTargetMismatch

## src/LandingApp.js
- LandingApp

## src/lib/backendUrl.js
- isLocalHostname
- isLocalUrl
- resolveBackendUrl

## src/lib/e2ee/adapter/pulseCryptoMock.js
- decode
- encode
- rand

## src/lib/e2ee/attachmentAccessAdapter.js
- applyAttachmentActionResultState
- assertAttachmentBinaryAccessSupported
- assertAttachmentMetadataIntegrity
- buildAttachmentAccessVerification
- buildAttachmentActionErrorState
- buildAttachmentActionSuccessState
- buildAttachmentMetadataUrl
- buildPreparedAttachmentActionTarget
- buildResolvedAttachmentAccessContract
- cacheAttachmentMetadata
- createAttachmentActionRunner
- createFutureDraftAttachmentAccessProvider
- createRemoteAttachmentAccessProvider
- decryptAttachmentBlob
- executePreparedAttachmentAction
- fetchAttachmentBlob
- fetchAttachmentMetadata
- getAttachmentAccessInfo
- getAttachmentActionFailureMessage
- getAttachmentContractFromHeaders
- getAttachmentIdFromAttachment
- getCachedAttachmentMetadata
- mapAttachmentContractError
- mergeAttachmentMetadata
- openAttachmentInNewTab
- passthroughDecryptAttachmentBlob
- prepareAttachmentBinaryAccess
- resolveAttachmentContractFields
- resolveAttachmentForAccess
- resolveAttachmentForBinaryAction
- resolveAttachmentUnwrapContext
- resolveExpectedAttachmentSha256
- runAttachmentActionFlow
- runAttachmentBinaryAction
- runAttachmentBinaryActionWithState
- triggerAttachmentDownload

## src/lib/e2ee/attachmentCrypto.js
- base64ToBytes
- buildAttachmentEncryptionMetadata
- buildFutureAttachmentEncryptionDraft
- buildMockAttachmentEncryptionMetadata
- buildMockWrappedMediaKey
- bytesToHex
- computeDigestHex
- computeTextDigestHex
- createMockEncryptedAttachmentEnvelope
- decodeMockAttachmentEnvelopeDataUrl
- decodeMockWrappedMediaKey
- decryptAttachmentEnvelopeBlob
- decryptMockAttachmentEnvelopeBlob
- fromBase64Utf8
- getAttachmentEncryptionCapability
- isMockAttachmentEncryption
- parseDataUrl
- resolveAttachmentEncryptionStrategy
- toBase64Utf8
- unwrapAttachmentMediaKey
- unwrapMockWrappedMediaKey
- validateAttachmentMediaKeyContract
- validateMockWrappedMediaKeyContract
- verifyMockAttachmentEnvelope

## src/lib/e2ee/attachmentPayload.js
- getAttachmentDisplayName
- isImageAttachment
- normalizeAttachmentPayload
- resolveAttachmentUrl
- validateAttachmentPayload

## src/lib/e2ee/attachmentPresentation.js
- buildAttachmentInteractionState
- buildAttachmentMessageCardPresentation
- buildAttachmentRenderState
- buildAttachmentSummaryPresentation
- getAttachmentAccessVerificationPresentation
- getAttachmentActionButtonProps
- getAttachmentActionButtonsPresentation
- getAttachmentActionButtonStyle
- getAttachmentActionPresentation
- getAttachmentActionRowStyle
- getAttachmentActionsPresentation
- getAttachmentBaseDisplayText
- getAttachmentBodyLayoutPresentation
- getAttachmentBodyPresentation
- getAttachmentCardInteractionProps
- getAttachmentCardPresentation
- getAttachmentContentPresentation
- getAttachmentContractPresentation
- getAttachmentDetailLines
- getAttachmentDetailLineStyle
- getAttachmentErrorStyle
- getAttachmentFileBadgePresentation
- getAttachmentImagePreviewStyle
- getAttachmentInteractionPresentation
- getAttachmentMetaStyle
- getAttachmentPreviewText
- getAttachmentStrategyPresentation
- getAttachmentTimestampStyle
- getAttachmentVariantPresentation

## src/lib/e2ee/attachmentStrategyConstants.js
- getAttachmentStrategyDisplayName
- getAttachmentStrategyHint
- getAttachmentStrategyStoragePrefix

## src/lib/e2ee/config.js
- getServiceTransportFallbackBannerState
- probeE2EEServiceReady

## src/lib/e2ee/conversationSummaries.js
- applyCallConversationSummaryToList
- applyConversationSummaryToList
- buildConversationAttachmentPreviewState
- buildConversationAttachmentSummaryFields
- buildConversationAttachmentSummaryPresentation
- buildConversationAttachmentSummaryPreview
- buildConversationAttachmentSummaryState
- buildConversationBasePreview
- buildConversationCallSummaryFields
- buildConversationMessageSummaryFields
- buildConversationPreviewAttachmentFields
- buildConversationPreviewPresentation
- buildConversationSummaryAttachmentEncryptionSource
- buildConversationSummaryAttachmentMetadataSource
- buildConversationSummaryAttachmentPayload
- buildConversationSummaryAttachmentSource
- buildConversationSummaryMessageFields
- buildConversationSummaryMessageState
- buildConversationSummaryUpdate
- buildEmptyConversationAttachmentSummaryFields
- buildEmptyConversationCallSummaryFields
- buildEmptyConversationPreviewAttachmentFields
- buildNormalizedConversationAttachmentSummaryFields
- deriveAttachmentNameFromPreview
- hasConversationAttachmentSummaryFields
- normalizeConversationAttachmentSummary
- normalizeConversationSummaryRecord
- resolveConversationCallSummaryLabel
- resolveConversationPreviewSpecialCaseText
- resolveConversationPreviewText
- resolveConversationSummaryAttachmentName
- resolveConversationSummaryAttachmentPayloadSource
- resolveConversationSummaryUpdatedAt
- sortConversationSummaryList

## src/lib/e2ee/deviceBootstrap.js
- bootstrapDevice
- detectPlatform
- hasActiveRegisteredDevice

## src/lib/e2ee/messageCopy.js
- getDeletedMessageDisplayText
- getEncryptedMessageDisplayText
- getSharedContactDisplayText
- getSharedContactFallbackDisplayText

## src/lib/e2ee/messageModel.js
- buildPendingMessage
- getMessageDisplayText
- normalizeIncomingMessage
- patchPendingMessageAsFailed
- patchPendingMessageAsSent

## src/lib/e2ee/messageReactions.js
- normalizeSingleUserReaction
- toggleSingleUserReaction

## src/lib/e2ee/messageTransportPayload.js
- buildForwardServicePayload
- buildRetryServicePayload
- buildServiceMessageResult
- buildSocketMessagePayload
- getOutgoingMessageScopeError
- getStructuredMessageType
- isSupportedOutgoingMessageType
- resolveOutgoingMessageDisplayText
- resolveSupportedOutgoingMessageType

## src/lib/e2ee/messageTypeConstants.js
- resolveKnownPulseMessageType

## src/lib/e2ee/messagingService.js
- buildRequestBody
- deserializeMessagePayload
- ensureSessions
- fetchKeyBundle
- getAuthToken
- hydrateMockCiphertext
- sendEncryptedPayload
- serializeMessagePayload

## src/lib/e2ee/originStorageMigration.js
- canUseStorage
- getLegacyBridgeUrl
- getLegacyImportAttemptKey
- getLegacyImportSuccessKey
- importLegacyE2EEStateIfNeeded
- isImportPayloadForUser
- isWebAppRuntime
- markLegacyImportAttempted
- markLegacyImportSuccessful
- normalizeImportedIdentity
- normalizeImportedSessions
- requestLegacyE2EEExport
- stripImportQueryParams
- tryReadImportedPayloadFromWindowName
- wasLegacyImportAttempted
- wasLegacyImportSuccessful

## src/lib/e2ee/policy.js
- canApplyPlaintextEditUpdate
- canEditMessage
- isEncryptedProtocol

## src/lib/e2ee/secureKeyStore.js
- identityKey

## src/lib/e2ee/sessionStore.js
- sessionKey

## src/lib/marketingAuthEvents.js
- requestMarketingAuth

## src/lib/platform/runtime.js
- isNativePulseEnvironment
- isPulseWebBrowser

## src/screens/AuthScreen.js
- activateFeature
- AuthScreen
- flipCards
- handleSubmit
- loadRuntimeInfo

## src/screens/ChatScreen.js
- cancelConversationSelection
- cancelMessageSelection
- ChatScreen
- close
- deleteSelectedConversations
- enterConversationSelection
- enterMessageSelection
- handleDeleteRequest
- handleDeleteSelectedMessages
- handleJumpToMsg
- handlePin
- handler
- handleStar
- onKeyDown
- openClearConversationConfirm
- openConversationAndRun
- openDeleteConversationConfirm
- pending
- persistMutedConversationIds
- sendContactCard
- setConvLabel
- showErrToast
- stored
- toggleConversationMute
- toggleConversationSelection
- toggleDnd
- toggleMessageSelection

## src/screens/ContactPagina.js
- BadgeStrip
- ContactForm
- ContactInfoCard
- ContactPagina
- handleClick
- handler
- handleSubmit
- set
- useFadeIn
- validate

## src/screens/ElektronischeCommunicatieBeleidPagina.js
- ElektronischeCommunicatieBeleidPagina
- LegalSection
- LegalSubsection

## src/screens/FunctiePagina.js
- BgMockup
- CallHistoryMockup
- CallMockup
- ChatHeader
- DecorativeAvatar
- FeatureRow
- FunctiePagina
- GridCard
- GroupMockup
- h
- handleCallTabKeyDown
- handleChatTabKeyDown
- makeAdventurerAvatar
- ManageMockup
- MockAvatar
- PhoneMockup
- PrivacyVideoMockup
- scrollGridSectionIntoView
- scrollTabRowToActive
- scrollTo
- SectionHeader
- SidebarMockup
- useFadeIn
- VideoMockup

## src/screens/HoeWerktHetPagina.js
- AddChildMockup
- AddContactButtonMockup
- BrowserMockup
- ConnectedMockup
- ContactsOverviewMockup
- handler
- HoeWerktHetPagina
- RegistrationMockup
- scrollTabRowToActive
- scrollTo
- SearchContactMockup
- SectionIntro
- StepCopy
- StepRow
- useFadeIn

## src/screens/Homepage.js
- DownloadOptionsSection
- handler
- HeroVideo
- Homepage
- scrollCards
- updateScrollState

## src/screens/OuderlijkToezichtPagina.js
- ActivityMockup
- DashboardMockup
- handler
- NotificationMockup
- OuderlijkToezichtPagina
- PauseMockup
- PhoneFrame
- scrollTo
- SectionHeader
- SectionRow
- StatsMockup
- StepsOverview
- useFadeIn

## src/screens/OverPulsePagina.js
- FadeRow
- FeatureStrip
- handler
- OverPulsePagina
- scrollTo
- useFadeIn

## src/screens/ParentAuthScreen.js
- activateFeature
- handleCodeInput
- handleCodeKeyDown
- handleCodePaste
- handleResend
- handleSubmit
- handleTabKeyDown
- handleVerify
- ParentAuthScreen
- postJson
- verifyInner

## src/screens/ParentDashboard.js
- acceptCoparentInvitation
- buildTopList
- changeChildUsername
- changePassword
- checkUsernameAvailability
- close
- createChild
- declineCoparentInvitation
- deleteChild
- filteredContacts
- formatLocationLastSeen
- getRelationLabel
- parentBlockContact
- ParentDashboard
- parentRemoveContact
- parentUnblockContact
- pauseChild
- resumeChild
- sendCoparentInvite
- validateCreateUsername

## src/screens/PrivacybeleidPagina.js
- LegalSection
- LegalSubsection
- PrivacybeleidPagina

## src/screens/PrivacyFirstPagina.js
- FadeRow
- handler
- PrivacyFirstPagina
- useFadeIn

## src/screens/PushDiagnosticsScreen.js
- PushDiagnosticsScreen
- Row

## src/screens/ResetPasswordScreen.js
- handleSubmit
- ResetPasswordScreen

## src/screens/SitemapPagina.js
- SitemapPagina
- SitemapSection

## src/services/appUpdate.js
- addUpdateStatusListener
- completeFlexibleUpdate
- fetchNativeUpdateStatus
- fetchUpdatePolicy
- isAndroidNative
- startFlexibleUpdate
- startImmediateUpdate

## src/services/pushNotifications.js
- addListener
- logInfo
- logWarn
- postToken
- registerNativePush
- registerWebPush
- setupPulsePushNotifications

## src/services/socket.js
- acceptVideoUpgrade
- answerCall
- bindPeerConnectionDebugHandlers
- buildCallSessionId
- buildPreferredAudioConstraints
- buildPreferredVideoConstraints
- cleanup
- cleanupCall
- clearCallLifecycleHandlers
- clearIncomingRingingSession
- connectSocket
- declineCall
- describeSession
- disconnectSocket
- endCall
- ensureSocketConnection
- fireOnEnd
- flushRemoteIceCandidates
- getCurrentCallSessionId
- getIceServers
- getSocket
- isCallInProgress
- isSessionEventCurrent
- logIgnoredSessionEvent
- markRemoteDescriptionReady
- onConnect
- onConnectError
- onConnectionStateChange
- onIceConnectionStateChange
- queueRemoteIceCandidate
- registerIncomingRingingSession
- rejectCallAsBusy
- requestCallMedia
- setCallState
- startCall
- switchCameraTrack
- upgradeToVideo

## src/utils.js
- callPreview
- clearPulseUserStorage
- clearStorageKeys
- copyTextToClipboard
- createSvgDataUrl
- formatConversationListTime
- formatDateLabel
- formatTime
- getInitials
- getPulseCachedBlockedContactsStorageKey
- getPulseCachedContactsStorageKey
- getPulseCachedConversationsStorageKey
- getPulseCachedFriendRequestsStorageKey
- getPulseCachedMessagesStorageKey
- getPulseCachedSentFriendRequestsStorageKey
- getPulseHistoryRulesStorageKey
- getPulseSessionConversationsStorageKey
- getSafeInternalPath
- getScrollBehavior
- isValidEmail
- normalizeEmail
- normalizeHistoryRetentionDays
- normalizeHistoryRules
- normalizeUsername
- parseDate
- readCachedBlockedContacts
- readCachedContacts
- readCachedConversations
- readCachedFriendRequests
- readCachedMessages
- readCachedSentFriendRequests
- readSessionConversations
- readStoredHistoryRules
- safeJsonParse
- sanitizeDisplayName
- scheduleIdleTask
- timeAgo
- toMs
- writeCachedBlockedContacts
- writeCachedContacts
- writeCachedConversations
- writeCachedFriendRequests
- writeCachedMessages
- writeCachedSentFriendRequests
- writeSessionConversations
- writeStoredHistoryRules

