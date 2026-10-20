import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pulsemessenger.chat',
  appName: 'Pulse',
  webDir: 'build',
  loggingBehavior: 'none',
  server: {
    cleartext: false,
  },
  android: {
    webContentsDebuggingEnabled: false,
  },
};

export default config;
