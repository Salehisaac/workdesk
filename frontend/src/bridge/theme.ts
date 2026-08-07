// Theme sync — plan section 3. Applies bridge theme as CSS custom properties
// on <html>, before React mounts, then keeps them in sync on live changes.
// This file is the only thing that changes if the bridge's theme param field
// names turn out to differ once confirmed.
import { bridge } from './index';
import type { ColorScheme, ThemeParams } from './types';

const CSS_VAR_PREFIX = '--rasagram-theme-';

function applyTheme(theme: ThemeParams & { colorScheme: ColorScheme }): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme)) {
    if (key === 'colorScheme' || !value) continue;
    root.style.setProperty(`${CSS_VAR_PREFIX}${key.replace(/_/g, '-')}`, value);
  }
  root.dataset.colorScheme = theme.colorScheme;
}

/** Call once, before the app mounts. Returns an unsubscribe function. */
export function bootTheme(): () => void {
  applyTheme(bridge.theme.get());
  return bridge.onThemeChange(applyTheme);
}
