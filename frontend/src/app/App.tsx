import { QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd-mobile';
import { BrowserRouter } from 'react-router-dom';
import { queryClient } from '../shared/api/queryClient';
import { AppRouter } from './router';

export function App() {
  // antd-mobile has no RTL prop to set here (verified against the installed
  // version — its Config type only covers locale/icons). RTL comes from
  // <html dir="rtl"> (index.html) + postcss-rtlcss flipping antd-mobile's
  // otherwise LTR-only CSS at build time — see postcss.config.js.
  return (
    <ConfigProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </QueryClientProvider>
    </ConfigProvider>
  );
}
