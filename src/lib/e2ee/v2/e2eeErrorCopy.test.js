import { getE2eeLoadErrorMessage, getE2eeSendErrorMessage } from './e2eeErrorCopy';

describe('E2EE error copy', () => {
  test('uses actionable copy for a native encryption failure', () => {
    expect(getE2eeSendErrorMessage({ code: 'e2ee_encrypt_failed' }))
      .toBe('De beveiligde sessie kon niet worden hersteld. Probeer het opnieuw.');
  });

  test('does not expose unknown internal error codes', () => {
    expect(getE2eeSendErrorMessage(new Error('native_internal_detail')))
      .toBe('Versleuteld bericht verzenden mislukt');
  });
});

describe('getE2eeLoadErrorMessage', () => {
  test('hides internal pilot allowlist codes from users', () => {
    expect(getE2eeLoadErrorMessage(new Error('v2_pilot_conversation_not_allowed'))).toBe(
      'Dit gesprek is nog niet geactiveerd voor de beveiligde test.',
    );
  });
});
