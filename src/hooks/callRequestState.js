export const CALL_REQUEST_ADMISSION = Object.freeze({
  ALLOW: 'allow',
  CLEAR_ENDED: 'clear-ended',
  DUPLICATE: 'duplicate',
  ACTIVE: 'active',
});

export function getCallRequestAdmission(activeCall, startInProgress) {
  if (startInProgress) return CALL_REQUEST_ADMISSION.DUPLICATE;
  if (!activeCall) return CALL_REQUEST_ADMISSION.ALLOW;
  if (activeCall.endReason) return CALL_REQUEST_ADMISSION.CLEAR_ENDED;
  return CALL_REQUEST_ADMISSION.ACTIVE;
}

export function resolveDirectCallTarget(conversation, currentUid) {
  if (!conversation || !currentUid) return null;

  const candidates = [
    ...(Array.isArray(conversation.members) ? conversation.members : []),
    ...Object.keys(conversation.memberNames || {}),
    ...Object.keys(conversation.memberEmails || {}),
  ];
  const toUid = candidates.find((uid) => uid && uid !== currentUid);
  if (!toUid) return null;

  return {
    toUid,
    convId: conversation.id || null,
    name: conversation.memberNames?.[toUid]
      || conversation.memberEmails?.[toUid]
      || 'Contactpersoon',
  };
}

export function withCallPreparationTimeout(operation, timeoutMs, timeoutMessage = 'Oproep voorbereiden duurde te lang. Controleer je verbinding en probeer opnieuw.') {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(timeoutMessage)),
      timeoutMs,
    );
  });
  return Promise.race([Promise.resolve().then(operation), timeout])
    .finally(() => clearTimeout(timeoutId));
}
