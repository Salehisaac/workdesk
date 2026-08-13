// Real implementation — wraps window.Rasagram.WebApp, injected by
// https://rasagram.rso-co.ir/miniapps/rasagram-web-apps.js (loaded in index.html).
// This is the ONLY file allowed to touch `window.Rasagram` — see plan section 4.
import type { Bridge, ColorScheme, DeviceContact, Insets, PickedItem, PickOptions, ThemeParams } from './types';

// The real shape of window.Rasagram.WebApp is only partially confirmed (plan
// section 4 / "Open Risks"). Kept as `any` here rather than a precise type so
// this one file absorbs the uncertainty instead of leaking `any` app-wide.
declare global {
  interface Window {
    Rasagram?: { WebApp?: any };
  }
}

function webApp(): any {
  const wa = window.Rasagram?.WebApp;
  if (!wa) {
    throw new Error(
      'Rasagram.WebApp is not available — this page must be opened inside the Rasagram client, or run against src/bridge/mock.ts for local dev.',
    );
  }
  return wa;
}

const NO_INSETS: Insets = { top: 0, bottom: 0, left: 0, right: 0 };

/**
 * How long to wait for the client to answer `web_app_pick` before giving up.
 *
 * Generous on purpose: this clock covers the user actually browsing and
 * choosing people in the native sheet, not just the client's round trip. The
 * case it exists for is the opposite one — a client that never opens a sheet
 * at all — where the whole window elapses with nothing on screen.
 */
const PICK_TIMEOUT_MS = 45_000;

/**
 * Fills in the two options the documented example always passes.
 *
 * Both are marked optional in the docs, and the SDK happily omits them from
 * the payload when they are absent — but the native side is what actually
 * parses that payload, and a required-field read there (`getString("title")`
 * and friends) would throw on a key that isn't present, which from the
 * webview looks exactly like the client ignoring the event. Cheap enough to
 * always send that it isn't worth leaving as a variable.
 */
function pickPayload(options: PickOptions): PickOptions {
  return { maxSelection: 10, title: 'انتخاب مخاطب', ...options };
}

/**
 * The SDK exposes safeAreaInset / contentSafeAreaInset as plain objects it
 * fills in from client events, so before the client has answered (or on a
 * client that never does) the fields can be missing entirely — not just zero.
 * Coerced here so callers only ever see four numbers.
 */
function toInsets(raw: any): Insets {
  if (!raw) return NO_INSETS;
  return {
    top: Number(raw.top) || 0,
    bottom: Number(raw.bottom) || 0,
    left: Number(raw.left) || 0,
    right: Number(raw.right) || 0,
  };
}

/**
 * Whether openTelegramLink will actually POST the link to the client rather
 * than fall back to navigating away.
 *
 * Mirrors the deployed SDK's own gate verbatim - `isIframe ||
 * versionAtLeast('6.1')`, where its isIframe is `window.parent != null &&
 * window != window.parent`. Worth mirroring rather than trusting, because the
 * SDK's else-branch is `location.href = 'https://t.me' + path_full`: on an old
 * client that would not open the topic, it would navigate the webview to the
 * REAL t.me and strand the user outside Rasagram.
 */
function canPostTgLink(wa: any): boolean {
  if (window.parent != null && window !== window.parent) return true;

  const [major, minor] = String(wa.version ?? '0')
    .split('.')
    .map((part: string) => parseInt(part, 10) || 0);
  return major > 6 || (major === 6 && minor >= 1);
}

export const adapterBridge: Bridge = {
  // -- assumed (plan "Open Risks") --
  getEnv() {
    const wa = webApp();
    return {
      userId: String(wa.initDataUnsafe?.user?.id ?? ''),
      initData: wa.initData ?? '',
      platform: wa.platform ?? 'unknown',
      version: wa.version ?? '0',
      // Telegram's own field name, which this SDK is a fork of — the value
      // after `?startapp=` on the link that launched the app.
      startParam: wa.initDataUnsafe?.start_param ?? '',
    };
  },
  ready() {
    webApp().ready?.();
  },
  expand() {
    webApp().expand?.();
  },
  close() {
    webApp().close?.();
  },
  theme: {
    get(): ThemeParams & { colorScheme: ColorScheme } {
      const wa = webApp();
      return { ...(wa.themeParams ?? {}), colorScheme: (wa.colorScheme as ColorScheme) ?? 'light' };
    },
  },
  onThemeChange(cb) {
    return adapterBridge.onEvent('themeChanged', () => cb(adapterBridge.theme.get()));
  },
  mainButton: {
    show() {
      webApp().MainButton?.show?.();
    },
    hide() {
      webApp().MainButton?.hide?.();
    },
    setText(text) {
      webApp().MainButton?.setText?.(text);
    },
    onClick(cb) {
      const mb = webApp().MainButton;
      mb?.onClick?.(cb);
      return () => mb?.offClick?.(cb);
    },
  },
  backButton: {
    show() {
      webApp().BackButton?.show?.();
    },
    hide() {
      webApp().BackButton?.hide?.();
    },
    onClick(cb) {
      const bb = webApp().BackButton;
      bb?.onClick?.(cb);
      return () => bb?.offClick?.(cb);
    },
  },
  viewport: {
    isFullscreen() {
      return !!webApp().isFullscreen;
    },
    safeArea() {
      return toInsets(webApp().safeAreaInset);
    },
    contentSafeArea() {
      return toInsets(webApp().contentSafeAreaInset);
    },
    requestFullscreen() {
      webApp().requestFullscreen?.();
    },
    exitFullscreen() {
      webApp().exitFullscreen?.();
    },
  },
  // -- confirmed --
  /**
   * The native multi-source picker.
   *
   * Wrapped rather than passed straight through, because the SDK's own pick()
   * settles in exactly one place — its `pick_result` handler, matched by the
   * `req_id` it generated — and does nothing else. A client that ignores
   * `web_app_pick`, or answers it with a req_id that doesn't match, leaves
   * that promise pending forever; the caller's catch never runs and the user
   * sees the button do literally nothing. Both holes are closed here:
   *
   *  - a raw `pickResult` listener, which the SDK fires on every reply
   *    regardless of req_id, so a mismatched answer still delivers the choice
   *  - a timeout, so "the client never answered" surfaces as an error the
   *    caller can show instead of a silent hang
   */
  async pick(options: PickOptions): Promise<PickedItem[]> {
    const wa = webApp();
    if (typeof wa.pick !== 'function') {
      throw new Error('این نسخه‌ی رساگرام انتخاب مخاطب را ندارد (pick تعریف نشده است).');
    }

    return new Promise<PickedItem[]>((resolve, reject) => {
      let settled = false;
      let timer = 0;
      let stopWatching = () => {};

      function finish(action: () => void) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        stopWatching();
        action();
      }

      // Registered BEFORE the event goes out — a client that answers
      // synchronously would otherwise beat the listener into place.
      stopWatching = adapterBridge.onEvent('pickResult', (payload: any) => {
        finish(() => resolve(payload?.status === 'picked' ? payload?.items ?? [] : []));
      });

      timer = window.setTimeout(() => {
        finish(() =>
          reject(
            new Error(
              'رساگرام به درخواست انتخاب مخاطب پاسخی نداد. ' +
                'رویداد web_app_pick ارسال شد ولی pick_result برنگشت — ' +
                'یعنی این نسخه‌ی کلاینت این قابلیت را پیاده‌سازی نکرده است.',
            ),
          ),
        );
      }, PICK_TIMEOUT_MS);

      wa.pick(pickPayload(options)).then(
        (items: PickedItem[]) => finish(() => resolve(items ?? [])),
        (err: unknown) => finish(() => reject(err instanceof Error ? err : new Error(String(err)))),
      );
    });
  },
  openContactPicker(): Promise<DeviceContact | null> {
    return new Promise((resolve) => {
      webApp().openContactPicker((ok: boolean, contact: DeviceContact) => {
        resolve(ok ? contact : null);
      });
    });
  },
  openLink(url: string): boolean {
    const wa = webApp();
    if (typeof wa.openLink !== 'function') return false;
    try {
      wa.openLink(url);
      return true;
    } catch (err) {
      // A malformed URL, most likely — someone typed a room name into the
      // link field. Not worth taking the page down over; the caller says so.
      console.error('[bridge] openLink rejected', url, err);
      return false;
    }
  },
  openTelegramLink(url: string): boolean {
    const wa = webApp();
    if (typeof wa.openTelegramLink !== 'function' || !canPostTgLink(wa)) return false;
    try {
      wa.openTelegramLink(url);
      return true;
    } catch (err) {
      // WebAppTgUrlInvalid - a caller built the link with the wrong host. A
      // bug, but not one worth taking the page down over: report it as "did
      // not open" and let the caller show its own message.
      console.error('[bridge] openTelegramLink rejected', url, err);
      return false;
    }
  },
  onEvent(event, handler) {
    const wa = webApp();
    wa.onEvent(event, handler);
    return () => wa.offEvent?.(event, handler);
  },
};
