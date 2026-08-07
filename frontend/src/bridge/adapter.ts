// Real implementation — wraps window.Rasagram.WebApp, injected by
// https://rasagram.rso-co.ir/miniapps/rasagram-web-apps.js (loaded in index.html).
// This is the ONLY file allowed to touch `window.Rasagram` — see plan section 4.
import type {
  Bridge,
  ColorScheme,
  CreateGroupOptions,
  CreateGroupResult,
  DeviceContact,
  PickedItem,
  PickOptions,
  ThemeParams,
} from './types';

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
  async createGroup(options: CreateGroupOptions): Promise<CreateGroupResult> {
    const wa = webApp();
    if (typeof wa.createGroup !== 'function') {
      throw new Error(
        'Rasagram.WebApp.createGroup is not implemented by the bridge yet — see plan section 8 / "Open Risks" #1.',
      );
    }
    return wa.createGroup(options);
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
