/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_PAGSEGURO_PUBLIC_KEY: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_SUPPORT_PHONE: string;
  readonly VITE_PAGSEGURO_PLATFORM_RECIPIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
