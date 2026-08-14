// Theme sync — plan section 3. Applies bridge theme as CSS custom properties
// on <html>, before React mounts, then keeps them in sync on live changes.
// This file is the only thing that changes if the bridge's theme param field
// names turn out to differ once confirmed.
import { bridge } from './index';
import type { ColorScheme, ThemeParams } from './types';

const CSS_VAR_PREFIX = '--rasagram-theme-';

/**
 * Temporary: never render dark, whatever the client is set to.
 *
 * Two separate things would otherwise make the app dark, and both are handled
 * below — the client pushes its own palette as inline custom properties (which
 * beat tokens.css, since an element style always wins over a stylesheet), and
 * tokens.css keys its own dark palette off `[data-color-scheme='dark']`.
 *
 * Only a client that says it is *dark* is ignored. A light client's colors are
 * still applied, because they can't make the app dark and they're what makes it
 * look like it belongs in that client — so the cost of this switch is paid only
 * by the people it is actually for.
 *
 * Set to false to hand the theme back to the client; nothing else has to change,
 * and the dark palette is still sitting in tokens.css waiting for it.
 */
const FORCE_LIGHT: boolean = true;

// Dark endpoint for the hero-card gradient, per colorScheme — chosen once
// here rather than derived (deriving a good-looking darker shade from an
// arbitrary bridge accent color at runtime is unreliable), but everything
// else about the gradient/shadow now tracks the live bridge theme instead
// of being fixed constants (tokens.css's old split only worked if
// `[data-color-scheme]` happened to out-specificity `:root`, and even then
// never reflected the bridge's *actual* accent — just a hardcoded guess).
const GRADIENT_END: Record<ColorScheme, string> = { light: '#155e75', dark: '#083344' };
const CARD_SHADOW: Record<ColorScheme, string> = {
  light: '0 1px 3px rgba(15, 23, 31, 0.08)',
  dark: '0 1px 3px rgba(0, 0, 0, 0.4)',
};

/**
 * Every custom property this module has written to <html>.
 *
 * Kept because the client can switch theme while the app is open: going
 * light → dark under FORCE_LIGHT has to *remove* what was applied, not merely
 * stop applying, or the light palette in tokens.css stays buried under stale
 * inline values.
 */
const appliedVars = new Set<string>();

function setVar(name: string, value: string): void {
  document.documentElement.style.setProperty(name, value);
  appliedVars.add(name);
}

function applyTheme(theme: ThemeParams & { colorScheme: ColorScheme }): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme)) {
    if (key === 'colorScheme' || !value) continue;
    setVar(`${CSS_VAR_PREFIX}${key.replace(/_/g, '-')}`, value);
  }
  root.dataset.colorScheme = theme.colorScheme;

  const accent = theme.button_color ?? theme.accent_text_color ?? GRADIENT_END[theme.colorScheme];
  setVar('--rasagram-hero-gradient', `linear-gradient(135deg, ${accent} 0%, ${GRADIENT_END[theme.colorScheme]} 100%)`);
  setVar('--rasagram-card-shadow', CARD_SHADOW[theme.colorScheme]);
}

/**
 * Drops back to WorkDesk's own palette — the `:root` block in tokens.css, which
 * is light by definition.
 */
function applyOwnLightTheme(): void {
  const root = document.documentElement;
  for (const name of appliedVars) {
    root.style.removeProperty(name);
  }
  appliedVars.clear();
  // Stated rather than left unset: tokens.css keys the dark palette off this
  // attribute, so writing 'light' is what un-keys it on a live switch.
  root.dataset.colorScheme = 'light';
}

function syncTheme(theme: ThemeParams & { colorScheme: ColorScheme }): void {
  if (FORCE_LIGHT && theme.colorScheme === 'dark') {
    applyOwnLightTheme();
    return;
  }
  applyTheme(theme);
}

/** Call once, before the app mounts. Returns an unsubscribe function. */
export function bootTheme(): () => void {
  syncTheme(bridge.theme.get());
  return bridge.onThemeChange(syncTheme);
}
