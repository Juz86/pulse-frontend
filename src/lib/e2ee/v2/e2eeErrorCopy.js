const E2EE_ERROR_COPY = Object.freeze({
  e2ee_encrypt_failed: 'De beveiligde sessie kon niet worden hersteld. Probeer het opnieuw.',
  v2_remote_identity_changed: 'De beveiligingssleutel van een apparaat is gewijzigd. Controleer het apparaat opnieuw.',
  v2_device_approval_pending: 'Beveiligde functies wachten op goedkeuring van je ouder.',
  v2_pilot_sends_paused: 'Versleuteld verzenden is tijdelijk gepauzeerd.',
  v2_pilot_conversation_not_allowed: 'Dit gesprek is nog niet geactiveerd voor de beveiligde test.',
  v2_recipient_set_mismatch: 'De apparaten van de ontvanger zijn gewijzigd. Probeer het opnieuw.',
});

export function getE2eeSendErrorMessage(error, fallback = 'Versleuteld bericht verzenden mislukt') {
  const code = error?.code || error?.message;
  return E2EE_ERROR_COPY[code] || fallback;
}

export function getE2eeLoadErrorMessage(error, fallback = 'Berichten laden mislukt') {
  const code = error?.code || error?.message;
  return E2EE_ERROR_COPY[code] || fallback;
}
