// Fixture-backed implementation for `vite dev` in a plain desktop browser,
// where window.Rasagram doesn't exist. Selected automatically by ./index.ts.
// Add ?theme=dark to the URL to preview the dark palette.
import type { Bridge, ColorScheme, DeviceContact, Insets, PickedItem, ThemeParams } from './types';

const FIXTURE_ITEMS: PickedItem[] = [
  { id: '101', source: 'contacts', displayName: 'علی رضایی', username: 'ali', phone: '989120000001', online: true },
  { id: '102', source: 'contacts', displayName: 'سارا محمدی', username: 'sara', phone: '989120000002', online: false },
  { id: '103', source: 'users', displayName: 'رضا احمدی', username: 'reza', online: true },
  { id: '-201', source: 'groups', displayName: 'گروه طراحی' },
  { id: '-301', source: 'channels', displayName: 'کانال اطلاعیه‌ها' },
];

// Kept in sync with shared/styles/tokens.css's fallback palette by hand —
// this is what "no real bridge theme" looks like in dev, same as prod's
// fallback. If they drift, dev preview stops matching the real fallback.
const LIGHT_THEME: ThemeParams = {
  bg_color: '#ffffff',
  text_color: '#0f1115',
  hint_color: '#7c8894',
  link_color: '#0891b2',
  button_color: '#0891b2',
  button_text_color: '#ffffff',
  secondary_bg_color: '#f1f5f7',
  header_bg_color: '#ffffff',
  accent_text_color: '#0891b2',
  section_bg_color: '#ffffff',
  section_header_text_color: '#7c8894',
  subtitle_text_color: '#5c6773',
  destructive_text_color: '#e5484d',
};

const DARK_THEME: ThemeParams = {
  bg_color: '#0b0f14',
  text_color: '#eef2f5',
  hint_color: '#8a97a3',
  link_color: '#22d3ee',
  button_color: '#06b6d4',
  button_text_color: '#ffffff',
  secondary_bg_color: '#141b23',
  header_bg_color: '#0b0f14',
  accent_text_color: '#22d3ee',
  section_bg_color: '#141b23',
  section_header_text_color: '#8a97a3',
  subtitle_text_color: '#9aa6b2',
  destructive_text_color: '#ff6b6b',
};

let scheme: ColorScheme = new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light';
const themeListeners = new Set<(t: ThemeParams & { colorScheme: ColorScheme }) => void>();
const eventListeners = new Map<string, Set<(payload: any) => void>>();

function currentTheme(): ThemeParams & { colorScheme: ColorScheme } {
  return { ...(scheme === 'dark' ? DARK_THEME : LIGHT_THEME), colorScheme: scheme };
}

function emit(event: string, payload?: any): void {
  eventListeners.get(event)?.forEach((handler) => handler(payload));
}

const NO_INSETS: Insets = { top: 0, bottom: 0, left: 0, right: 0 };

// Roughly what an iPhone-class device reports in fullscreen: the status bar on
// top of the notch, the home indicator at the bottom, and — separately — the
// ~46px band the client's own floating header occupies. Only fixtures, but
// keeping the two apart is the point: the app has to clear *both*.
const FULLSCREEN_SAFE_AREA: Insets = { top: 44, bottom: 34, left: 0, right: 0 };
const FULLSCREEN_CONTENT_SAFE_AREA: Insets = { top: 46, bottom: 0, left: 0, right: 0 };

// ?fullscreen=1 previews full mode from the first paint; the console helper
// below toggles it live, the way the client's own menu does.
let fullscreen = new URLSearchParams(window.location.search).get('fullscreen') === '1';

function setFullscreen(next: boolean): void {
  fullscreen = next;
  emit('fullscreenChanged');
  emit('safeAreaChanged');
  emit('contentSafeAreaChanged');
}

// Exposed only for manual testing from the browser console:
// __workdeskMockBridge.setScheme('dark')
// __workdeskMockBridge.setFullscreen(true)
(window as any).__workdeskMockBridge = {
  setScheme(next: ColorScheme) {
    scheme = next;
    themeListeners.forEach((cb) => cb(currentTheme()));
  },
  setFullscreen,
};

// Real requests need a real signed initData (plan section 5) — the mock
// bridge obviously can't produce one (it doesn't have the bot token, and
// never should). For local dev against a real backend, generate one with
// `python3 scripts/sign_init_data.py` (in the Goravel project root) and
// paste it in as ?initData=<value>. Without it, requests still go out for
// real — they'll just get a real 401, same as a genuinely unauthenticated
// caller would.
//
// Captured into sessionStorage at module load (not lazily inside
// getEnv()!): React Router's client-side navigate() doesn't preserve query
// params across routes, so if capture waited for the first API call, a page
// with no API call of its own (the hub) would navigate away before anything
// ever read the param — sessionStorage would stay empty and every
// subsequent request would silently fall back to the fake token and 401.
const INIT_DATA_STORAGE_KEY = 'workdesk:mockInitDataOverride';

const initDataFromUrl = new URLSearchParams(window.location.search).get('initData');
if (initDataFromUrl) {
  sessionStorage.setItem(INIT_DATA_STORAGE_KEY, initDataFromUrl);
}

function mockInitData(): string {
  return sessionStorage.getItem(INIT_DATA_STORAGE_KEY) ?? 'mock.init.data';
}

// ?startapp=session-3 in dev does what tapping a session invite does in the
// client — read once at module load for the same reason initData is: the app
// navigates away from '/' before anything gets around to looking at the URL.
const startParamFromUrl = new URLSearchParams(window.location.search).get('startapp') ?? '';

export const mockBridge: Bridge = {
  getEnv() {
    return {
      userId: 'mock-user-1',
      initData: mockInitData(),
      platform: 'web-mock',
      version: '0.0-mock',
      startParam: startParamFromUrl,
    };
  },
  ready() {},
  expand() {},
  close() {
    console.info('[bridge:mock] close()');
  },
  theme: { get: currentTheme },
  onThemeChange(cb) {
    themeListeners.add(cb);
    return () => themeListeners.delete(cb);
  },
  mainButton: {
    show() {},
    hide() {},
    setText() {},
    onClick: () => () => {},
  },
  backButton: {
    show() {},
    hide() {},
    onClick: () => () => {},
  },
  viewport: {
    isFullscreen: () => fullscreen,
    safeArea: () => (fullscreen ? FULLSCREEN_SAFE_AREA : NO_INSETS),
    contentSafeArea: () => (fullscreen ? FULLSCREEN_CONTENT_SAFE_AREA : NO_INSETS),
    requestFullscreen: () => setFullscreen(true),
    exitFullscreen: () => setFullscreen(false),
  },
  async pick(options) {
    const items = FIXTURE_ITEMS.filter((item) => options.sources.includes(item.source));
    const limited = options.multiple ? items.slice(0, options.maxSelection ?? items.length) : items.slice(0, 1);
    return limited;
  },
  async openContactPicker(): Promise<DeviceContact | null> {
    return { contact_id: 'device-1', name: 'مخاطب دستگاه', phones: ['09120000000'], emails: [] };
  },
  openTelegramLink(url: string): boolean {
    // There is no client to hand this to in dev, and actually following it
    // would navigate away from the app being worked on. Log the path the real
    // client would receive (openTelegramLink forwards pathname + search only)
    // so the link can be eyeballed without leaving the page.
    console.info('[bridge:mock] openTelegramLink()', new URL(url).pathname);
    return true;
  },
  onEvent(event, handler) {
    const set = eventListeners.get(event) ?? new Set();
    set.add(handler);
    eventListeners.set(event, set);
    return () => set.delete(handler);
  },
};
