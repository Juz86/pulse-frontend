export const ATTACHMENT_NONE_STRATEGY = 'none';
export const ATTACHMENT_MOCK_MEDIA_STRATEGY = 'mock_media_v1';
export const ATTACHMENT_EXTERNAL_CONTRACT_STRATEGY = 'external_contract';
export const ATTACHMENT_FUTURE_MEDIA_STRATEGY = 'pulse_media_v1';

export const ATTACHMENT_MOCK_ENVELOPE_ALG = 'mock-e2ee-envelope-v1';
export const ATTACHMENT_FUTURE_ENVELOPE_ALG = 'pulse-media-envelope-v1';

export const ATTACHMENT_MOCK_ENVELOPE_KIND = 'pulse_mock_media_envelope';
export const ATTACHMENT_FUTURE_ENVELOPE_KIND = 'pulse_media_envelope';

export const ATTACHMENT_MOCK_KEY_WRAP_ALG = 'pulse_mock_media_key_wrap_v1';
export const ATTACHMENT_FUTURE_KEY_WRAP_ALG = 'pulse_media_key_wrap_v1';

export function getAttachmentStrategyHint(strategyKey = '') {
  if (!strategyKey) return '';
  if (strategyKey === ATTACHMENT_FUTURE_MEDIA_STRATEGY) return 'future-draft';
  if (strategyKey === ATTACHMENT_MOCK_MEDIA_STRATEGY) return 'mock-profiel';
  return strategyKey;
}

export function getAttachmentStrategyStoragePrefix(strategyKey = '') {
  if (strategyKey === ATTACHMENT_MOCK_MEDIA_STRATEGY) return 'Mock';
  if (strategyKey === ATTACHMENT_FUTURE_MEDIA_STRATEGY) return 'Toekomstige';
  return strategyKey ? 'Versleutelde' : '';
}

export function getAttachmentStrategyDisplayName(strategyKey = '') {
  const hint = getAttachmentStrategyHint(strategyKey);
  if (!hint) return '';
  if (hint === strategyKey) return strategyKey;
  return `${hint} (${strategyKey})`;
}
