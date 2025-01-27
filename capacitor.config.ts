import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.pjcone.portal',
  appName: 'Project: Cone',
  webDir: 'www',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'http',
  },
  cordova: {
    accessOrigins: ['*', 'http://*', 'https://*'],
    preferences: {
      SplashScreen: 'none',
      AndroidInsecureFileModeEnabled: 'true',
      iosExtraWebviewFlags: '--shared-preference-rejected-code-point-workaround --enable-file-cookies',
      androidExtraWebviewFlags: '--shared-preferences',
      CrossOriginOpenerPolicy: 'same-origin',
      CrossOriginEmbedderPolicy: 'require-corp',
      Hostname: '*',
    },
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "icon_mono",
      iconColor: "#ffd94e",
      // sound: "beep.wav",
    },
  },
};

export default config;
