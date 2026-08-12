// An on-device dev console (Eruda) — Console, Network, Elements, Resources,
// the lot — for debugging inside the Rasagram client, where no real DevTools
// exist. This is the same thing other mini apps ship as a floating gear button.
//
// Android's Telegram-derived clients run the mini app in a plain WebView with
// remote debugging switched off, so `chrome://inspect` sees nothing. If you
// build the Rasagram Android client yourself, one line there
// (`WebView.setWebContentsDebuggingEnabled(true)`) gives you REAL DevTools,
// which beats this on every axis — request headers, timing, breakpoints. This
// exists for when you don't control the client build.

import { bridge } from '../../bridge';

/** Query param that turns the console on (`?debug=1`) or off (`?debug=0`). */
const DEBUG_PARAM = 'debug';

/** Survives reloads, so the param only has to be passed once. */
const DEBUG_STORAGE_KEY = 'workdesk:debugConsole';

/**
 * User ids the console is always on for, from VITE_DEBUG_USER_IDS (comma
 * separated). Baked in at build time — this is the switch to use when you
 * want to debug a PRODUCTION build on your own phone without touching the
 * bot's configured URL.
 */
function alwaysOnUserIds(): string[] {
  return (import.meta.env.VITE_DEBUG_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * Whether to load the console, and remember the answer.
 *
 * The query param is read from `window.location.search` rather than the
 * router, both because this runs before React mounts and because the client
 * appends its own `#tgWebAppData=…` fragment — which leaves the search string
 * alone.
 *
 * `?debug=1` is the bootstrap route: the WebView's localStorage is its own,
 * not the phone browser's, so there is no way to set the flag from outside.
 * Point the bot's mini app URL at `…?debug=1` once, load it, then put the URL
 * back — the flag persists on that device until `?debug=0` clears it.
 */
function shouldEnable(userId: string): boolean {
  const param = new URLSearchParams(window.location.search).get(DEBUG_PARAM);
  if (param === '1') {
    localStorage.setItem(DEBUG_STORAGE_KEY, '1');
    return true;
  }
  if (param === '0') {
    localStorage.removeItem(DEBUG_STORAGE_KEY);
    return false;
  }

  if (localStorage.getItem(DEBUG_STORAGE_KEY) === '1') return true;
  if (userId && alwaysOnUserIds().includes(userId)) return true;

  // Always available under `vite dev`, where it costs nothing and there is no
  // production bundle to keep clean.
  return import.meta.env.DEV;
}

/**
 * The signed-in user's id, or '' if it cannot be read.
 *
 * Defensive because this runs FIRST, before bootTheme/ready — earlier than
 * anything else that touches the SDK. A debugging aid must not be the thing
 * that takes the app down when the client injects something unexpected, so a
 * failure here just means the id-allowlist route is unavailable; the query
 * param and dev-build routes still work.
 */
function currentUserId(): string {
  try {
    return bridge.getEnv().userId;
  } catch {
    return '';
  }
}

/**
 * Starts the console when enabled, otherwise does nothing at all.
 *
 * Eruda is `import()`ed rather than imported at the top so Vite splits it into
 * its own chunk: a normal user never downloads a byte of it. It is also why
 * this is async — and why callers should NOT await it (see main.tsx).
 *
 * Must run before the app issues any requests. Eruda's Network panel works by
 * patching `fetch`/`XMLHttpRequest`, so anything sent before it loads is
 * invisible to it — which is exactly the request you would want to see.
 */
export async function bootDebugConsole(): Promise<void> {
  if (!shouldEnable(currentUserId())) return;

  try {
    const eruda = (await import('eruda')).default;
    eruda.init({ defaults: { displaySize: 50, transparency: 0.95 } });
  } catch (error) {
    // A missing chunk must never take the app down — the console is a
    // debugging aid, not a feature.
    console.error('[workdesk:debug] could not start the dev console', error);
  }
}
