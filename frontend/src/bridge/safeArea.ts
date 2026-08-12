// Safe-area sync — the fullscreen counterpart to theme.ts. Same shape: apply
// bridge state as CSS custom properties on <html> before React mounts, then
// keep them in sync as the client reports changes.
//
// Why it's needed: in normal mode the client lays its header out *above* the
// webview, so the page starts at y=0 of free space and env(safe-area-inset-*)
// is all the app ever needs. In fullscreen ("full mode") the webview covers
// the entire screen instead, and the client paints the status bar and its
// floating Close / collapse / menu buttons over the top of the page. Anything
// the app draws at the top — the home header, every NavBar — lands underneath
// them. That band is what --wd-safe-top clears.
import { bridge } from './index';
import type { Insets } from './types';

const CSS_VAR_PREFIX = '--wd-safe-';

const SIDES = ['top', 'bottom', 'left', 'right'] as const;

// The client's floating header is ~46px tall on the platforms that report it.
// Used only when a client turns fullscreen on but never answers the SDK's
// safe-area requests (the SDK asks at boot via web_app_request_content_safe_area
// and leaves the insets at 0 until the client replies). Overlapping chrome is a
// far worse failure than a slightly-too-tall gap, so assume the band exists
// until told otherwise.
const ASSUMED_CLIENT_HEADER_PX = 46;

// Per side: what to fall back to when the client hasn't reported that inset.
// The device's own env() values are the honest answer for the screen itself —
// they're what tokens.css uses outside fullscreen too.
const DEVICE_FALLBACK: Record<(typeof SIDES)[number], string> = {
  top: 'env(safe-area-inset-top, 0px)',
  bottom: 'env(safe-area-inset-bottom, 0px)',
  left: 'env(safe-area-inset-left, 0px)',
  right: 'env(safe-area-inset-right, 0px)',
};

// Whether the client has ever answered — tracked separately per inset because
// a client can support one and not the other, and 0 is a legitimate reported
// value (a desktop client in fullscreen has no status bar), indistinguishable
// from "never answered" if we only looked at the numbers.
let reportedSafeArea = false;
let reportedContentSafeArea = false;

function sideValue(side: (typeof SIDES)[number], safe: Insets, content: Insets): string {
  const device = reportedSafeArea ? `${safe[side]}px` : DEVICE_FALLBACK[side];
  const client = reportedContentSafeArea
    ? `${content[side]}px`
    : side === 'top'
      ? `${ASSUMED_CLIENT_HEADER_PX}px`
      : '0px';
  return `calc(${device} + ${client})`;
}

function apply(): void {
  const root = document.documentElement;
  const isFullscreen = bridge.viewport.isFullscreen();
  root.dataset.fullscreen = isFullscreen ? 'true' : 'false';

  if (!isFullscreen) {
    // Nothing overlaps the page, so the plain device insets that tokens.css
    // declares are already correct — drop the inline overrides rather than
    // restate them, so there's one definition of the non-fullscreen case.
    for (const side of SIDES) root.style.removeProperty(`${CSS_VAR_PREFIX}${side}`);
    return;
  }

  const safe = bridge.viewport.safeArea();
  const content = bridge.viewport.contentSafeArea();
  for (const side of SIDES) {
    root.style.setProperty(`${CSS_VAR_PREFIX}${side}`, sideValue(side, safe, content));
  }
}

/** Call once, before the app mounts. Returns an unsubscribe function. */
export function bootSafeArea(): () => void {
  const unsubscribes = [
    bridge.onEvent('fullscreenChanged', apply),
    bridge.onEvent('safeAreaChanged', () => {
      reportedSafeArea = true;
      apply();
    }),
    bridge.onEvent('contentSafeAreaChanged', () => {
      reportedContentSafeArea = true;
      apply();
    }),
    // Rotation and keyboard show/hide both arrive as viewportChanged and can
    // move the insets without a dedicated safe-area event of their own.
    bridge.onEvent('viewportChanged', apply),
  ];

  apply();

  return () => unsubscribes.forEach((off) => off());
}
