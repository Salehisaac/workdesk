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

export const adapterBridge: Bridge = {
  // -- assumed (plan "Open Risks") --
  getEnv() {
    const wa = webApp();
    return {
      userId: String(wa.initDataUnsafe?.user?.id ?? ''),
      initData: wa.initData ?? '',
      platform: wa.platform ?? 'unknown',
      version: wa.version ?? '0',
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
  async pick(options: PickOptions): Promise<PickedItem[]> {
    return webApp().pick(options);
  },
  openContactPicker(): Promise<DeviceContact | null> {
    return new Promise((resolve) => {
      webApp().openContactPicker((ok: boolean, contact: DeviceContact) => {
        resolve(ok ? contact : null);
      });
    });
  },
  onEvent(event, handler) {
    const wa = webApp();
    wa.onEvent(event, handler);
    return () => wa.offEvent?.(event, handler);
  },
};
