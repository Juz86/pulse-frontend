import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pulsemessenger.chat',
  appName: 'Pulse',
  webDir: 'build',
  server: {
    cleartext: false,
  },
};

export default config;
