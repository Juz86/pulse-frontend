import { checkE2eeV2PilotEnrollment } from './pilotEnrollment';

describe('E2EE v2 production pilot enrollment', () => {
  const user = { uid: 'user-a', getIdToken: jest.fn() };

  test('allows runtime bootstrap only for an enabled enrolled account', async () => {
    const api = {
      getPilotStatus: jest.fn().mockResolvedValue({
        enabled: true,
        enrolled: true,
        mode: 'pilot',
        sendingEnabled: false,
      }),
    };
    await expect(checkE2eeV2PilotEnrollment({ user, api })).resolves.toEqual({
      enabled: true,
      enrolled: true,
      mode: 'pilot',
      sendingEnabled: false,
    });
  });

  test('keeps non-enrolled accounts disabled', async () => {
    const api = {
      getPilotStatus: jest.fn().mockResolvedValue({
        enabled: true,
        enrolled: false,
        mode: 'pilot',
        sendingEnabled: true,
      }),
    };
    await expect(checkE2eeV2PilotEnrollment({ user, api })).resolves.toMatchObject({
      enrolled: false,
    });
  });
});
