import '@fontsource-variable/vazirmatn';
import './shared/styles/tokens.css';
import './shared/styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { bridge } from './bridge';
import { bootTheme } from './bridge/theme';

bootTheme();
bridge.ready();
bridge.expand();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
