const mockSocket = {
  auth: {},
  connected: true,
  connect: jest.fn(),
  disconnect: jest.fn(),
  emit: jest.fn(),
  on: jest.fn(),
};
jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}));

jest.mock('../lib/platform/runtime', () => ({
  isNativePulseEnvironment: jest.fn(() => true),
}));

jest.mock('../config/runtimeConfig', () => ({ WS_URL: '' }));
jest.mock('../lib/backendUrl', () => ({ resolveBackendUrl: () => 'https://pulse.test' }));

const { io: mockIo } = require('socket.io-client');
const {
  connectSocket,
  disconnectSocket,
  setSocketE2EEDeviceId,
} = require('./socket');

describe('Socket E2EE v2 device binding', () => {
  beforeEach(() => {
    disconnectSocket();
    jest.clearAllMocks();
    mockSocket.connected = true;
    mockSocket.auth = {};
    mockIo.mockReturnValue(mockSocket);
  });

  afterAll(() => disconnectSocket());

  test('reconnects an active socket with the validated device id', () => {
    connectSocket('user-a', 'token-a');
    setSocketE2EEDeviceId('device-a1');

    expect(mockSocket.auth).toMatchObject({
      token: 'token-a',
      e2eeDeviceId: 'device-a1',
    });
    expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
    expect(mockSocket.connect).toHaveBeenCalledTimes(1);
  });

  test('includes a device binding set before the initial connection', () => {
    setSocketE2EEDeviceId('device-a1');
    connectSocket('user-a', 'token-a');

    expect(mockIo).toHaveBeenCalledWith(
      'https://pulse.test',
      expect.objectContaining({
        auth: expect.objectContaining({
          token: 'token-a',
          e2eeDeviceId: 'device-a1',
        }),
      }),
    );
    expect(mockSocket.disconnect).not.toHaveBeenCalled();
  });

  test('does not reconnect twice for the same binding', () => {
    connectSocket('user-a', 'token-a');
    setSocketE2EEDeviceId('device-a1');
    jest.clearAllMocks();

    setSocketE2EEDeviceId('device-a1');

    expect(mockSocket.disconnect).not.toHaveBeenCalled();
    expect(mockSocket.connect).not.toHaveBeenCalled();
  });

  test('rejects an invalid device id before changing the socket', () => {
    connectSocket('user-a', 'token-a');

    expect(() => setSocketE2EEDeviceId('device id')).toThrow('v2_socket_device_invalid');
    expect(mockSocket.disconnect).not.toHaveBeenCalled();
  });
});
