import '@fontsource-variable/vazirmatn';
import './shared/styles/tokens.css';
import './shared/styles/global.css';

import { setDefaultConfig } from 'antd-mobile';
import faIR from 'antd-mobile/es/locales/fa-IR';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { bridge } from './bridge';
import { bootSafeArea } from './bridge/safeArea';
import { bootTheme } from './bridge/theme';
import { bootDebugConsole } from './shared/debug/console';

// First, and deliberately not awaited. Eruda's Network panel only sees traffic
// sent after it has patched fetch/XMLHttpRequest, so it starts as early as
// possible; awaiting it would instead hold the whole app behind a chunk
// download that is skipped entirely for normal users. See ./shared/debug.
void bootDebugConsole();

bootTheme();
// Before ready(): in fullscreen the client's own header overlaps the page, and
// this is what reserves room for it. Running it first means the first painted
// frame is already laid out correctly instead of jumping once the insets land.
bootSafeArea();
bridge.ready();
bridge.expand();

// Imperative APIs (Dialog.alert, Toast.show, etc.) read getDefaultConfig(),
// NOT the <ConfigProvider> React context — App.tsx's <ConfigProvider
// locale={faIR}> alone doesn't cover them, hence this separate call. Without
// it they fall back to antd-mobile's default (Chinese) strings, which
// Vazirmatn has no glyphs for — e.g. Dialog's confirm button silently
// rendered as tofu boxes until this was added.
setDefaultConfig({ locale: faIR });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
