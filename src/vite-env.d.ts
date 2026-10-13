/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPEN_METEO_BASE_URL?: string;
  readonly VITE_API_TIMEOUT_MS?: string;
  readonly VITE_ENABLE_OFFLINE_FALLBACK?: string;
  readonly [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
