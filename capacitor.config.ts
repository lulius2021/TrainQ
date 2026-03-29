import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.CAPACITOR_DEV === '1';

const config: CapacitorConfig = {
  appId: 'com.trainq.app',
  appName: 'TrainQ',
  webDir: 'dist',
  ...(isDev && {
    server: {
      url: 'http://localhost:5173',
      cleartext: true,
    },
  }),
  backgroundColor: '#F2F2F7',
  ios: {
    backgroundColor: '#F2F2F7',
    contentInset: 'automatic',
    scrollEnabled: false,
  },
  plugins: {
    CapacitorHttp: {
      enabled: false,
    },
    Keyboard: {
      resize: 'none',
    },
  },
};

export default config;
