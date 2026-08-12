import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import postcssRtlcss from 'postcss-rtlcss';
// Dev-only: proxies /api to the local Goravel server so the browser only ever
// talks to one origin. Production serves both from the same Go binary (see plan section 7),
// so no proxy/CORS config is needed there.
export default defineConfig({
    plugins: [react()],
    css: {
        // antd-mobile's CSS is LTR-only (physical left/right, not logical
        // properties) — verified in node_modules/antd-mobile/es/components/**/*.css.
        // This generates [dir="rtl"] overrides for every rule at build time, so
        // <html dir="rtl"> (index.html) correctly mirrors antd-mobile's own
        // components too, not just our CSS Modules. Configured inline rather than
        // via postcss.config.js — Vite's external-config loader didn't pick up
        // the plugin (silently produced zero overrides), this does reliably.
        postcss: {
            plugins: [postcssRtlcss({ mode: 'override' })],
        },
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:3000',
                changeOrigin: true,
            },
        },
        // Vite 5+ blocks requests whose Host header isn't localhost/an IP by
        // default (rebinding-attack protection) — needed for real-device
        // testing through a tunnel (ngrok, etc.) since the free tier's
        // subdomain changes on every restart, so a specific hostname can't be
        // hardcoded here.
        allowedHosts: ['.ngrok-free.app'],
    },
    // Default outDir (dist/). Deploy copies dist/* into ../public — see plan section 7.
});
