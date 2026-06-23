import {
  ATTACHMENT_FUTURE_ENVELOPE_ALG,
  ATTACHMENT_FUTURE_MEDIA_STRATEGY,
  ATTACHMENT_MOCK_ENVELOPE_ALG,
  ATTACHMENT_MOCK_MEDIA_STRATEGY,
  getAttachmentStrategyHint,
  getAttachmentStrategyStoragePrefix,
} from './attachmentStrategyConstants';
import { getAttachmentDisplayName } from './attachmentPayload';
import { getAttachmentEncryptionCapability } from './attachmentCrypto';
import { getAttachmentAccessInfo } from './attachmentAccessAdapter';

function getAttachmentStrategyPresentation(attachment = {}) {
  const strategyKey =
    attachment?.strategyKey
    || attachment?.encryption?.strategyKey
    || (attachment?.contentEncoding === ATTACHMENT_FUTURE_ENVELOPE_ALG
      ? ATTACHMENT_FUTURE_MEDIA_STRATEGY
      : (attachment?.contentEncoding === ATTACHMENT_MOCK_ENVELOPE_ALG
        ? ATTACHMENT_MOCK_MEDIA_STRATEGY
        : ''));
  const isMockStrategy = strategyKey === ATTACHMENT_MOCK_MEDIA_STRATEGY;
  const isFutureStrategy = strategyKey === ATTACHMENT_FUTURE_MEDIA_STRATEGY;

  return {
    strategyKey,
    isMockStrategy,
    isFutureStrategy,
    strategyHintLabel: getAttachmentStrategyHint(strategyKey),
    storageLabelPrefix: getAttachmentStrategyStoragePrefix(strategyKey),
  };
}

function getAttachmentContractPresentation(attachment = {}) {
  const transfer = attachment?.transfer || null;
  const strategyPresentation = getAttachmentStrategyPresentation(attachment);
  const strategyKey = strategyPresentation.strategyKey;
  const contentEncoding = attachment?.contentEncoding || '';
  const strategyCapability = getAttachmentEncryptionCapability({
    ...(attachment?.encryption || {}),
    strategyKey,
    alg: attachment?.encryption?.alg || contentEncoding || '',
  });
  const originalMimeType = attachment?.originalMimeType || attachment?.mimeType || '';
  const envelopeKind = attachment?.envelopeKind || attachment?.encryption?.envelopeKind || '';
  const expectedPayloadSha256 = attachment?.expectedPayloadSha256 || attachment?.encryption?.sha256 || '';
  const mediaKeyId = attachment?.encryption?.mediaKeyId || '';
  const keyWrapAlg = attachment?.encryption?.keyWrapAlg || '';
  const wrappedMediaKeyDigest = attachment?.encryption?.wrappedMediaKeyDigest || '';
  const isRemote = transfer === 'remote';
  const isMockEncryptedRemote =
    isRemote &&
    (
      strategyKey === ATTACHMENT_MOCK_MEDIA_STRATEGY ||
      contentEncoding === ATTACHMENT_MOCK_ENVELOPE_ALG
    );
  const isFutureEncryptedRemote =
    isRemote &&
    (
      strategyKey === ATTACHMENT_FUTURE_MEDIA_STRATEGY ||
      contentEncoding === ATTACHMENT_FUTURE_ENVELOPE_ALG
    );
  const isEncryptedRemote = isMockEncryptedRemote || isFutureEncryptedRemote;
  const hasIntegrityContract = Boolean(isEncryptedRemote && expectedPayloadSha256);
  const hasWrappedMediaKeyContract = Boolean(isEncryptedRemote && mediaKeyId && keyWrapAlg);
  const hasUnsupportedBinaryAccess = Boolean(
    isEncryptedRemote && !strategyCapability.binaryAccessSupported
  );
  const availabilityHintLabel = strategyCapability.requiresFutureStrategySupport
    ? 'binary access volgt later'
    : hasUnsupportedBinaryAccess
      ? 'clientondersteuning ontbreekt'
      : '';

  return {
    isRemote,
    isEncryptedRemote,
    hasIntegrityContract,
    hasWrappedMediaKeyContract,
    hasUnsupportedBinaryAccess,
    availabilityHintLabel,
    strategyHintLabel: strategyPresentation.strategyHintLabel,
    mimeLabel: originalMimeType || 'Bestand gedeeld',
    storageLabel: isMockEncryptedRemote
      ? `${strategyPresentation.storageLabelPrefix} versleutelde opslaglink`
      : isFutureEncryptedRemote
        ? `${strategyPresentation.storageLabelPrefix} versleutelde opslaglink`
        : isEncryptedRemote
          ? 'Versleutelde opslaglink'
          : isRemote
            ? 'Beveiligde opslaglink'
            : '',
    storageShortLabel: isEncryptedRemote
      ? 'versleuteld'
      : isRemote
        ? 'opslaglink'
        : '',
    storageDetail: isEncryptedRemote
      ? `Envelope: ${envelopeKind || 'encrypted media'}${strategyKey ? ` · strategie ${strategyKey}` : ''}${hasIntegrityContract ? ' · integriteitscheck actief' : ''}`
      : '',
    keyContractDetail: hasWrappedMediaKeyContract
      ? `Media key: ${mediaKeyId} · wrap: ${keyWrapAlg}${wrappedMediaKeyDigest ? ' · digest actief' : ''}`
      : '',
  };
}

function getAttachmentAccessVerificationPresentation(attachmentOrContract = {}, unwrapContext = null) {
  const accessVerification = attachmentOrContract?.accessVerification || null;
  const contract = accessVerification
    ? {
        strategyKey: typeof accessVerification.strategyKey === 'string' ? accessVerification.strategyKey : '',
        integrityVerified: Boolean(accessVerification.integrityVerified),
        wrappedKeyVerified: Boolean(accessVerification.wrappedKeyVerified),
      }
    : attachmentOrContract;
  const strategyKey = typeof contract?.strategyKey === 'string' ? contract.strategyKey : '';
  const resolvedUnwrapKind = unwrapContext?.unwrapKind || accessVerification?.unwrapKind || '';
  const integrityVerified = Boolean(contract?.integrityVerified);
  const wrappedKeyVerified = Boolean(contract?.wrappedKeyVerified);
  const hasUnwrapContext = Boolean(resolvedUnwrapKind && resolvedUnwrapKind !== 'none');
  const futureAccessPending =
    strategyKey === ATTACHMENT_FUTURE_MEDIA_STRATEGY
    && !integrityVerified
    && !wrappedKeyVerified;

  return {
    strategyLabel: strategyKey ? `Media-strategie: ${strategyKey}` : '',
    availabilityLabel: futureAccessPending ? 'Decrypt-draft actief voor pulse_media_v1' : '',
    integrityAccessLabel: integrityVerified ? 'Downloadcontract bevestigd' : '',
    wrappedKeyAccessLabel: wrappedKeyVerified
      ? `Wrapped media key gevalideerd${hasUnwrapContext ? ` · ${resolvedUnwrapKind}` : ''}`
      : '',
  };
}

function getAttachmentActionPresentation(accessInfo = {}) {
  const binaryAccessSupportLabel = accessInfo?.binaryAccessSupportLabel || '';
  const blockedByFutureDraft = binaryAccessSupportLabel === 'future_strategy_required';
  const blockedByUnsupportedStrategy = binaryAccessSupportLabel === 'unsupported';
  const actionsEnabled = Boolean(accessInfo?.canOpen) && !blockedByFutureDraft && !blockedByUnsupportedStrategy;

  return {
    actionsEnabled,
    openLabel: blockedByFutureDraft || blockedByUnsupportedStrategy ? 'Nog niet beschikbaar' : 'Openen',
    downloadLabel: 'Downloaden',
    availabilityDetail: blockedByFutureDraft
      ? 'Openen en downloaden worden actief zodra deze decrypt-strategie beschikbaar is.'
      : blockedByUnsupportedStrategy
        ? 'Deze versleutelingsstrategie ondersteunt nu nog geen openen of downloaden in de client.'
      : '',
  };
}

function getAttachmentInteractionPresentation(attachment = {}, unwrapContext = null) {
  const access = getAttachmentAccessInfo(attachment);
  const contract = getAttachmentContractPresentation(attachment);
  const verification = getAttachmentAccessVerificationPresentation(attachment, unwrapContext);
  const actions = getAttachmentActionPresentation(access);

  return {
    access,
    contract,
    verification,
    actions,
  };
}

function buildAttachmentInteractionState(
  messageAttachment = {},
  resolvedAttachment = null,
  resolvedAttachmentAccess = null
) {
  const attachment = resolvedAttachment || messageAttachment;
  const interaction = getAttachmentInteractionPresentation(
    attachment,
    resolvedAttachmentAccess?.unwrapContext
  );
  const previewUrl = interaction.access.isImage && attachment?.thumbnailUrl
    ? attachment.thumbnailUrl
    : interaction.access.url;

  return {
    attachment,
    interaction,
    access: interaction.access,
    contract: interaction.contract,
    verification: interaction.verification,
    actions: interaction.actions,
    previewUrl,
  };
}

function getAttachmentCardPresentation(attachment = {}, actionPresentation = {}) {
  const interactive = Boolean(actionPresentation?.actionsEnabled);
  const attachmentName = getAttachmentDisplayName(attachment);

  return {
    interactive,
    role: interactive ? 'button' : undefined,
    tabIndex: interactive ? 0 : undefined,
    ariaLabel: interactive ? `Open bijlage ${attachmentName}` : undefined,
    cursor: interactive ? 'pointer' : 'default',
  };
}

function getAttachmentCardInteractionProps(cardPresentation = {}, onOpen = null) {
  const interactive = Boolean(cardPresentation?.interactive && typeof onOpen === 'function');

  return {
    style: { cursor: cardPresentation?.cursor || 'default' },
    onClick: interactive ? () => onOpen() : undefined,
    onKeyDown: interactive
      ? (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen();
          }
        }
      : undefined,
  };
}

function getAttachmentActionButtonsPresentation(
  actionPresentation = {},
  { busy = false } = {}
) {
  const buttonsEnabled = Boolean(actionPresentation?.actionsEnabled) && !busy;

  return {
    buttonsEnabled,
    openDisabled: !buttonsEnabled,
    downloadDisabled: !buttonsEnabled,
    openLabel: busy ? 'Voorbereiden…' : (actionPresentation?.openLabel || 'Openen'),
    downloadLabel: actionPresentation?.downloadLabel || 'Downloaden',
  };
}

function getAttachmentActionButtonProps(action = 'open', onAction = null) {
  return {
    onClick: (event) => {
      event.stopPropagation();
      if (typeof onAction === 'function') {
        onAction(action);
      }
    },
  };
}

function getAttachmentActionsPresentation(
  buttonsPresentation = {},
  { isOwn = false, onAction = null } = {}
) {
  return {
    rowStyle: getAttachmentActionRowStyle(),
    buttons: [
      {
        key: 'open',
        disabled: Boolean(buttonsPresentation?.openDisabled),
        label: buttonsPresentation?.openLabel || 'Openen',
        style: getAttachmentActionButtonStyle('open', isOwn),
        props: getAttachmentActionButtonProps('open', onAction),
      },
      {
        key: 'download',
        disabled: Boolean(buttonsPresentation?.downloadDisabled),
        label: buttonsPresentation?.downloadLabel || 'Downloaden',
        style: getAttachmentActionButtonStyle('download', isOwn),
        props: getAttachmentActionButtonProps('download', onAction),
      },
    ],
  };
}

function getAttachmentActionButtonStyle(kind = 'open', isOwn = false) {
  const baseStyle = {
    minHeight: 32,
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 12,
  };

  if (kind === 'download') {
    return {
      ...baseStyle,
      background: 'transparent',
      color: isOwn ? 'rgba(255,255,255,.82)' : 'var(--text2)',
      border: isOwn ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.10)',
    };
  }

  return {
    ...baseStyle,
    background: isOwn ? 'rgba(255,255,255,0.14)' : 'rgba(124,58,237,0.10)',
    color: isOwn ? '#fff' : 'var(--accent)',
    border: isOwn ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(124,58,237,0.22)',
  };
}

function getAttachmentActionRowStyle() {
  return {
    display: 'flex',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  };
}

function getAttachmentImagePreviewStyle() {
  return {
    display: 'block',
    width: '100%',
    maxWidth: 280,
    maxHeight: 240,
    objectFit: 'cover',
    borderRadius: 14,
    marginBottom: 10,
  };
}

function getAttachmentMetaStyle(isOwn) {
  return {
    color: isOwn ? 'rgba(255,255,255,.65)' : 'var(--text3)',
  };
}

function getAttachmentTimestampStyle(isOwn) {
  return {
    fontSize: '11px',
    color: isOwn ? 'rgba(255,255,255,.5)' : 'var(--text3)',
    alignSelf: 'flex-end',
  };
}

function getAttachmentContentPresentation(
  attachment = {},
  contractPresentation = {},
  { isImage = false } = {}
) {
  return {
    title: attachment?.name || (isImage ? 'Afbeelding' : 'Bijlage'),
    subtitle: attachment?.caption || contractPresentation?.mimeLabel || '',
    imageAlt: attachment?.name || 'Gedeelde afbeelding',
    detailMarginTopForTone: (tone = 'detail') => {
      if (tone === 'storage') {
        return isImage ? 8 : 6;
      }
      return 4;
    },
  };
}

function getAttachmentBodyPresentation(
  contentPresentation = {},
  detailLines = [],
  actionError = '',
  {
    isOwn = false,
    actionsPresentation = null,
  } = {}
) {
  return {
    title: contentPresentation?.title || '',
    subtitle: contentPresentation?.subtitle || '',
    subtitleStyle: getAttachmentMetaStyle(isOwn),
    details: detailLines.map((line, index) => ({
      key: `${line.tone}-${index}`,
      text: line.text,
      className: 'u-fs-12',
      style: getAttachmentDetailLineStyle(
        isOwn,
        line.tone,
        typeof contentPresentation?.detailMarginTopForTone === 'function'
          ? contentPresentation.detailMarginTopForTone(line.tone)
          : 4
      ),
    })),
    errorText: actionError || '',
    errorStyle: actionError ? getAttachmentErrorStyle(isOwn) : null,
    actionsPresentation,
  };
}

function getAttachmentBodyLayoutPresentation(
  variantPresentation = {},
  contentPresentation = {},
  {
    previewUrl = '',
    fileBadgePresentation = null,
  } = {}
) {
  return {
    wrapperClassName: 'u-flex-1 u-min-w-0',
    preview: variantPresentation?.showsImagePreview
      ? {
          src: previewUrl,
          alt: contentPresentation?.imageAlt || 'Gedeelde afbeelding',
          style: getAttachmentImagePreviewStyle(),
        }
      : null,
    fileBadge: variantPresentation?.showsFileBadge
      ? {
          label: fileBadgePresentation?.label || 'F',
          style: fileBadgePresentation?.style || { borderRadius: 12 },
        }
      : null,
  };
}

function getAttachmentFileBadgePresentation() {
  return {
    label: 'F',
    style: {
      borderRadius: 12,
    },
  };
}

function getAttachmentVariantPresentation(access = {}) {
  const isImage = Boolean(access?.isImage);

  return {
    isImage,
    layout: isImage ? 'image' : 'file',
    showsImagePreview: isImage,
    showsFileBadge: !isImage,
  };
}

function buildAttachmentRenderState(
  messageAttachment = {},
  resolvedAttachment = null,
  resolvedAttachmentAccess = null,
  { busy = false } = {}
) {
  const interactionState = buildAttachmentInteractionState(
    messageAttachment,
    resolvedAttachment,
    resolvedAttachmentAccess
  );

  return {
    ...interactionState,
    variant: getAttachmentVariantPresentation(interactionState.access),
    content: getAttachmentContentPresentation(
      interactionState.attachment,
      interactionState.contract,
      { isImage: interactionState.access.isImage }
    ),
    fileBadge: interactionState.access.isImage
      ? null
      : getAttachmentFileBadgePresentation(),
    card: getAttachmentCardPresentation(
      interactionState.attachment,
      interactionState.actions
    ),
    buttons: getAttachmentActionButtonsPresentation(
      interactionState.actions,
      { busy }
    ),
  };
}

export function buildAttachmentMessageCardPresentation(
  messageAttachment = {},
  resolvedAttachment = null,
  resolvedAttachmentAccess = null,
  {
    busy = false,
    isOwn = false,
    actionError = '',
    onOpen = null,
    onAction = null,
  } = {}
) {
  const renderState = buildAttachmentRenderState(
    messageAttachment,
    resolvedAttachment,
    resolvedAttachmentAccess,
    { busy }
  );
  const detailLines = getAttachmentDetailLines(
    renderState.contract,
    renderState.verification,
    renderState.actions
  );
  const actionsPresentation = getAttachmentActionsPresentation(
    renderState.buttons,
    { isOwn, onAction }
  );
  const actions = renderState.access.canOpen ? (
    actionsPresentation.buttons
  ) : null;

  return {
    ...renderState,
    detailLines,
    actionsPresentation,
    cardInteraction: getAttachmentCardInteractionProps(renderState.card, onOpen),
    body: getAttachmentBodyPresentation(
      renderState.content,
      detailLines,
      actionError,
      { isOwn, actionsPresentation: actions }
    ),
    bodyLayout: getAttachmentBodyLayoutPresentation(
      renderState.variant,
      renderState.content,
      {
        previewUrl: renderState.previewUrl,
        fileBadgePresentation: renderState.fileBadge,
      }
    ),
    timestampStyle: getAttachmentTimestampStyle(isOwn),
  };
}

function getAttachmentDetailLines(
  contractPresentation = {},
  verificationPresentation = {},
  actionPresentation = {}
) {
  return [
    contractPresentation.isRemote && contractPresentation.storageLabel
      ? { tone: 'storage', text: contractPresentation.storageLabel }
      : null,
    contractPresentation.storageDetail
      ? { tone: 'detail', text: contractPresentation.storageDetail }
      : null,
    contractPresentation.hasIntegrityContract
      ? { tone: 'detail', text: 'Integriteit bevestigd via SHA-256 metadata' }
      : null,
    contractPresentation.keyContractDetail
      ? { tone: 'detail', text: contractPresentation.keyContractDetail }
      : null,
    verificationPresentation.integrityAccessLabel
      ? { tone: 'detail', text: verificationPresentation.integrityAccessLabel }
      : null,
    verificationPresentation.availabilityLabel
      ? { tone: 'availability', text: verificationPresentation.availabilityLabel }
      : null,
    actionPresentation.availabilityDetail
      ? { tone: 'availability', text: actionPresentation.availabilityDetail }
      : null,
    verificationPresentation.wrappedKeyAccessLabel
      ? { tone: 'availability', text: verificationPresentation.wrappedKeyAccessLabel }
      : null,
  ].filter(Boolean);
}

function getAttachmentDetailLineStyle(isOwn, tone = 'detail', marginTop = 4) {
  if (tone === 'storage') {
    return {
      marginTop,
      color: isOwn ? 'rgba(255,255,255,.78)' : 'var(--text3)',
      opacity: 0.9,
    };
  }

  if (tone === 'availability') {
    return {
      marginTop,
      color: isOwn ? 'rgba(255,255,255,.54)' : 'var(--text3)',
      opacity: 0.78,
    };
  }

  return {
    marginTop,
    color: isOwn ? 'rgba(255,255,255,.58)' : 'var(--text3)',
    opacity: 0.82,
  };
}

function getAttachmentErrorStyle(isOwn) {
  return {
    marginTop: 8,
    color: isOwn ? 'rgba(255,215,215,.92)' : '#ef4444',
  };
}

export function getAttachmentBaseDisplayText(attachment = {}) {
  return `Bijlage: ${getAttachmentDisplayName(attachment)}`;
}

function getAttachmentPreviewText(attachment = {}, { includeStorageSignal = true } = {}) {
  const presentation = getAttachmentContractPresentation(attachment);
  const baseLabel = getAttachmentBaseDisplayText(attachment);

  if (!includeStorageSignal || !presentation.storageShortLabel) {
    return baseLabel;
  }

  return `${baseLabel} · ${presentation.storageShortLabel}`;
}

export function buildAttachmentSummaryPresentation(
  attachment = {},
  { includeStorageSignal = true } = {}
) {
  const presentation = getAttachmentContractPresentation(attachment);

  return {
    presentation,
    previewText: getAttachmentPreviewText(attachment, { includeStorageSignal }),
  };
}
