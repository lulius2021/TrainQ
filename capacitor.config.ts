import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trainq.app',
  appName: 'TrainQ',
  webDir: 'dist',
  backgroundColor: '#000000',
  ios: {
    backgroundColor: '#000000',
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
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      showSpinner: false,
    },
  },
};

export default config;
