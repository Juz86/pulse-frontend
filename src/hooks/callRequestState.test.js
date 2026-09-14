import {
  CALL_REQUEST_ADMISSION,
  getCallRequestAdmission,
  resolveDirectCallTarget,
  withCallPreparationTimeout,
} from './callRequestState';

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

  test('times out a call preparation that never completes', async () => {
    jest.useFakeTimers();
    const pending = withCallPreparationTimeout(() => new Promise(() => {}), 1000);
    jest.advanceTimersByTime(1000);
    await expect(pending).rejects.toThrow('Oproep voorbereiden duurde te lang');
    jest.useRealTimers();
  });
});

describe('resolveDirectCallTarget', () => {
  test('uses the remote member of a normal direct conversation', () => {
    expect(resolveDirectCallTarget({
      id: 'conv-1',
      members: ['me', 'contact'],
      memberNames: { contact: 'Yousef' },
    }, 'me')).toEqual({ toUid: 'contact', convId: 'conv-1', name: 'Yousef' });
  });

  test('recovers a remote member from cached metadata', () => {
    expect(resolveDirectCallTarget({
      id: 'conv-cached',
      memberNames: { me: 'Kamilah', contact: 'Yousef' },
    }, 'me')).toEqual({ toUid: 'contact', convId: 'conv-cached', name: 'Yousef' });
  });

  test('returns null when no remote contact exists', () => {
    expect(resolveDirectCallTarget({ id: 'conv-invalid', members: ['me'] }, 'me')).toBeNull();
  });
});
