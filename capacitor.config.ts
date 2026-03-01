import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trainq.app',
  appName: 'TrainQ',
  webDir: 'dist',
  backgroundColor: '#F2F2F7',
  ios: {
    backgroundColor: '#F2F2F7',
    contentInset: 'automatic',
    scrollEnabled: false,
  },
};

export default config;
