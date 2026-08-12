/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Comma-separated Rasagram user ids the on-device dev console starts for
   * automatically — see shared/debug/console.ts. Baked in at build time, so
   * this is the switch for debugging a production build on your own phone
   * without changing the bot's configured mini app URL.
   */
  readonly VITE_DEBUG_USER_IDS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
