import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.deliverycity.app',
  appName: 'DeliveryCity',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  // Adicionado para incluir as variáveis de ambiente no build nativo
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
  cordova: {},
};

export default config;
