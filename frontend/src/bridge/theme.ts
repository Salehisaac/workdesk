// Theme sync — plan section 3. Applies bridge theme as CSS custom properties
// on <html>, before React mounts, then keeps them in sync on live changes.
// This file is the only thing that changes if the bridge's theme param field
// names turn out to differ once confirmed.
import { bridge } from './index';
import type { ColorScheme, ThemeParams } from './types';

const CSS_VAR_PREFIX = '--rasagram-theme-';

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

function applyTheme(theme: ThemeParams & { colorScheme: ColorScheme }): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme)) {
    if (key === 'colorScheme' || !value) continue;
    root.style.setProperty(`${CSS_VAR_PREFIX}${key.replace(/_/g, '-')}`, value);
  }
  root.dataset.colorScheme = theme.colorScheme;

  const accent = theme.button_color ?? theme.accent_text_color ?? GRADIENT_END[theme.colorScheme];
  root.style.setProperty('--rasagram-hero-gradient', `linear-gradient(135deg, ${accent} 0%, ${GRADIENT_END[theme.colorScheme]} 100%)`);
  root.style.setProperty('--rasagram-card-shadow', CARD_SHADOW[theme.colorScheme]);
}

/** Call once, before the app mounts. Returns an unsubscribe function. */
export function bootTheme(): () => void {
  applyTheme(bridge.theme.get());
  return bridge.onThemeChange(applyTheme);
}
