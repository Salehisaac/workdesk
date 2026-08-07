// Fixture-backed implementation for `vite dev` in a plain desktop browser,
// where window.Rasagram doesn't exist. Selected automatically by ./index.ts.
// Add ?theme=dark to the URL to preview the dark palette.
import type { Bridge, ColorScheme, DeviceContact, PickedItem, ThemeParams } from './types';

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

// Exposed only for manual testing from the browser console:
// __workdeskMockBridge.setScheme('dark')
(window as any).__workdeskMockBridge = {
  setScheme(next: ColorScheme) {
    scheme = next;
    themeListeners.forEach((cb) => cb(currentTheme()));
  },
};

export const mockBridge: Bridge = {
  getEnv() {
    return { userId: 'mock-user-1', initData: 'mock.init.data', platform: 'web-mock', version: '0.0-mock' };
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
  async createGroup(options) {
    console.info('[bridge:mock] createGroup', options);
    await new Promise((resolve) => setTimeout(resolve, 250));
    return { chatId: `mock-chat-${Math.round(performance.now())}` };
  },
  async pick(options) {
    const items = FIXTURE_ITEMS.filter((item) => options.sources.includes(item.source));
    const limited = options.multiple ? items.slice(0, options.maxSelection ?? items.length) : items.slice(0, 1);
    return limited;
  },
  async openContactPicker(): Promise<DeviceContact | null> {
    return { contact_id: 'device-1', name: 'مخاطب دستگاه', phones: ['09120000000'], emails: [] };
  },
  onEvent(event, handler) {
    const set = eventListeners.get(event) ?? new Set();
    set.add(handler);
    eventListeners.set(event, set);
    return () => set.delete(handler);
  },
};
