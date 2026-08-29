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
