import type { CapacitorConfig } from '@capacitor/cli';

const allowCleartext = process.env.CAPACITOR_ALLOW_CLEARTEXT === 'true';

const config: CapacitorConfig = {
  appId: 'com.pulsemessenger.chat',
  appName: 'Pulse',
  webDir: 'build',
  server: {
    cleartext: allowCleartext,
  },
};

export default config;
