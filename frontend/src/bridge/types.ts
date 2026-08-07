// Bridge contract — see plan section 4.
//
// Verified by downloading and reading the actual, deployed script
// (https://rasagram.rso-co.ir/miniapps/rasagram-web-apps.js — fetched
// 2026-08-07): it is Telegram's own official telegram-web-app.js SDK
// (same IIFE, same `postEvent`/`window.Rasagram.WebApp` shape, same
// MainButton/BackButton/HapticFeedback/CloudStorage/etc. surface), with
// `pick()`, `openContactPicker()`, and `requestPhone()` added on top. Nearly
// everything below is CONFIRMED against that source now, not assumed.

export type PickSource = 'users' | 'contacts' | 'groups' | 'channels' | 'bots' | 'recentChats' | 'favorites';

export interface PickOptions {
  sources: PickSource[];
  multiple?: boolean;
  maxSelection?: number;
  title?: string;
  search?: boolean;
  /** Confirmed present in the real payload; undocumented, defaults false. */
  allowEmpty?: boolean;
  /** Confirmed present in the real payload; undocumented, defaults true. */
  recentFirst?: boolean;
  /** Confirmed present in the real payload; undocumented, defaults false. */
  favoriteFirst?: boolean;
  placeholder?: string;
  /** Confirmed present in the real payload; shape not documented. */
  filters?: Record<string, unknown>;
}

export interface PickedItem {
  id: string;
  source: PickSource;
  displayName: string;
  username?: string;
  phone?: string;
  online?: boolean;
}

export interface DeviceContact {
  contact_id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  phones: string[];
  emails: string[];
}

export interface ThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
  [key: string]: string | undefined;
}

export type ColorScheme = 'light' | 'dark';

export interface BridgeEnv {
  userId: string;
  initData: string;
  platform: string;
  version: string;
}

export interface Bridge {
  // -- confirmed (see file header) --
  getEnv(): BridgeEnv;
  ready(): void;
  expand(): void;
  close(): void;
  theme: {
    get(): ThemeParams & { colorScheme: ColorScheme };
  };
  onThemeChange(cb: (theme: ThemeParams & { colorScheme: ColorScheme }) => void): () => void;
  mainButton: {
    show(): void;
    hide(): void;
    setText(text: string): void;
    onClick(cb: () => void): () => void;
  };
  backButton: {
    show(): void;
    hide(): void;
    onClick(cb: () => void): () => void;
  };
  pick(options: PickOptions): Promise<PickedItem[]>;
  openContactPicker(): Promise<DeviceContact | null>;
  onEvent(event: string, handler: (payload: any) => void): () => void;
}
