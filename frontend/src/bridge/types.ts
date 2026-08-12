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

/** Pixels of screen edge the app must not draw into. */
export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

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
  /**
   * Fullscreen ("full mode", SDK 8.0+). In fullscreen the client stops
   * reserving a strip above the webview for its own chrome and paints the
   * status bar and the floating Close / collapse / menu buttons *on top of*
   * the page instead — so the app has to keep its own top chrome clear of
   * them. See bridge/safeArea.ts, which is what actually consumes this.
   */
  viewport: {
    isFullscreen(): boolean;
    /** The device's own insets: status bar / notch / home indicator. */
    safeArea(): Insets;
    /** What the *client's* chrome claims on top of that (its floating header). */
    contentSafeArea(): Insets;
    requestFullscreen(): void;
    exitFullscreen(): void;
  };
  pick(options: PickOptions): Promise<PickedItem[]>;
  openContactPicker(): Promise<DeviceContact | null>;
  /**
   * Hands a link to the Rasagram client to open in its own UI — a chat, a
   * forum topic, an invite — and closes/backgrounds the mini app. NOT for
   * ordinary web links: those want openLink (external browser), which this
   * app has no use for yet.
   *
   * `url` MUST be written with the `t.me` host. Read the deployed SDK
   * (see this file's header) and the reason is plain: openTelegramLink
   * throws WebAppTgUrlInvalid on any other hostname, then forwards only
   * `pathname + search` over the `web_app_open_tg_link` event and discards
   * the host entirely. So `t.me` is a literal the validator demands, not a
   * destination anything actually resolves - the client receives just the
   * path and resolves it against Rasagram (rsog.rso-co.ir). Building the
   * link with the real host instead would throw before it ever got sent.
   *
   * Returns false when the client is too old to receive the event (below
   * SDK 6.1, outside an iframe), in which case NOTHING is opened - the
   * caller should say so rather than assume it worked. The SDK's own
   * fallback for that case navigates to the real t.me, which would throw
   * the user out of Rasagram; hence the check instead.
   */
  openTelegramLink(url: string): boolean;
  onEvent(event: string, handler: (payload: any) => void): () => void;
}
