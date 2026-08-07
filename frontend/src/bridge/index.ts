import { adapterBridge } from './adapter';
import { mockBridge } from './mock';

// window.Rasagram.WebApp always exists once the SDK script (loaded in
// index.html) has run — it unconditionally does `window.Rasagram = {}` and
// defines WebApp on it, regardless of environment. Checking only for its
// presence is NOT enough to detect "running inside the real client": in a
// plain browser tab, every WebApp method still exists but silently no-ops
// (each one calls postEvent, which the SDK itself only delivers through one
// of three transports — see below) — so pick()/etc. would hang forever with
// no error. Confirmed by reading the actual deployed script's postEvent()
// implementation: it checks, in order, window.TelegramWebviewProxy (native
// Android bridge), window.external.notify (older/Windows), then falls back
// to window.parent.postMessage only when embedded in an iframe. Mirror that
// same check here instead of trusting object presence alone.
function hasNativeTransport(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return (
    typeof w.TelegramWebviewProxy !== 'undefined' ||
    !!(w.external && 'notify' in w.external) ||
    window.parent !== window
  );
}

function hasRealBridge(): boolean {
  return typeof window !== 'undefined' && !!window.Rasagram?.WebApp && hasNativeTransport();
}

export const isMockBridge = !hasRealBridge();
export const bridge = isMockBridge ? mockBridge : adapterBridge;

export * from './types';
