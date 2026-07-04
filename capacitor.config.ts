import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.deliverycity.app',
  appName: 'DeliveryCity',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '524559004011-n6a7uditqedv7jfetq8127v4l9qu63f5.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
    // CapacitorHttp DESLIGADO: quando habilitado, ele substitui o fetch nativo e
    // quebra o supabase.auth.signInWithPassword() no APK (login de entregador/lojista
    // falhava). Sem efeito na web. Ver bug conhecido CapacitorHttp x supabase-js.
    CapacitorHttp: {
      enabled: false,
    },
  },
  cordova: {},
};

export default config;
