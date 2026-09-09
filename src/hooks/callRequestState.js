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

export function withCallPreparationTimeout(operation, timeoutMs) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error('Oproep voorbereiden duurde te lang. Controleer je verbinding en probeer opnieuw.')),
      timeoutMs,
    );
  });
  return Promise.race([Promise.resolve().then(operation), timeout])
    .finally(() => clearTimeout(timeoutId));
}
