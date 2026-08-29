import { CALL_REQUEST_ADMISSION, getCallRequestAdmission } from './callRequestState';

describe('getCallRequestAdmission', () => {
  test('allows a call when no call exists', () => {
    expect(getCallRequestAdmission(null, false)).toBe(CALL_REQUEST_ADMISSION.ALLOW);
  });

  test.each([
    ['voice', { toUid: 'contact-1', isVideo: false }],
    ['video', { toUid: 'contact-1', isVideo: true }],
  ])('blocks a live %s call', (_label, activeCall) => {
    expect(getCallRequestAdmission(activeCall, false)).toBe(CALL_REQUEST_ADMISSION.ACTIVE);
  });

  test.each(['timeout', 'declined', 'unavailable', 'busy'])(
    'clears an ended call with reason %s before starting again',
    (endReason) => {
      expect(getCallRequestAdmission({ toUid: 'contact-1', endReason }, false))
        .toBe(CALL_REQUEST_ADMISSION.CLEAR_ENDED);
    },
  );

  test('coalesces a duplicate request while the first request is preparing', () => {
    expect(getCallRequestAdmission(null, true)).toBe(CALL_REQUEST_ADMISSION.DUPLICATE);
  });
});
