import { QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd-mobile';
import faIR from 'antd-mobile/es/locales/fa-IR';
import { BrowserRouter } from 'react-router-dom';
import { queryClient } from '../shared/api/queryClient';
import { AppRouter } from './router';

export function App() {
  // antd-mobile has no RTL prop to set here (verified against the installed
  // version — its Config type only covers locale/icons). RTL comes from
  // <html dir="rtl"> (index.html) + postcss-rtlcss flipping antd-mobile's
  // otherwise LTR-only CSS at build time — see vite.config.ts's inline
  // css.postcss config.
  //
  // locale={faIR} matters beyond translation: without it, antd-mobile falls
  // back to its default (Chinese) strings — e.g. Dialog's "OK" button — and
  // Vazirmatn has no glyphs for those, so they silently render as tofu boxes.
  return (
    <ConfigProvider locale={faIR}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </QueryClientProvider>
    </ConfigProvider>
  );
}
