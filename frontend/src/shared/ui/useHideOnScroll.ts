import { useEffect, useState } from 'react';

/**
 * "Should a bottom-docked bar get out of the way right now?"
 *
 * Reading direction, not position: scrolling *down* means the reader is going
 * after content, so the dock leaves; scrolling *up* means they're navigating,
 * so it comes back. That's the same contract mobile browsers give their own
 * toolbars, which is why it needs no explanation on screen.
 *
 * Three states force it visible regardless of direction, and they're the whole
 * reason this isn't a two-line delta check:
 *
 *   - the page can't scroll at all (short day, or a filter tab narrowed it) —
 *     otherwise a page that shrinks under a hidden dock strands it off-screen
 *     with no gesture left to bring it back;
 *   - the reader is at the top, where nothing has been scrolled past yet;
 *   - the reader is at the very end, where the alternative is hiding the dock
 *     behind the empty padding reserved for it.
 *
 * Listens on the window because that's what actually scrolls here: <html>,
 * <body> and #root are all height:100% (shared/styles/global.css) and the page
 * simply overflows them, so there is no inner scroll container to attach to.
 */

/** Under this the page isn't meaningfully scrollable — rounding, not scrolling. */
const SCROLLABLE_SLACK_PX = 24;

/** Momentum and rubber-banding emit 1–3px deltas at rest; those aren't intent. */
const NOISE_PX = 6;

/** How far down the reader has to be before hiding is on the table at all. */
const ARM_AT_PX = 72;

/** Distance from the end that counts as "at the end". */
const BOTTOM_ZONE_PX = 48;

export function useHideOnScroll(): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const doc = document.documentElement;
    // Where the current gesture started, *not* the previous scroll position:
    // leaving it alone while deltas are below the noise floor is what lets a
    // slow, deliberate drag accumulate past the threshold instead of being
    // filtered out one pixel at a time.
    let anchor = window.scrollY;
    let frame = 0;

    function evaluate(fromScroll: boolean): void {
      const y = Math.max(0, window.scrollY);
      const max = Math.max(0, doc.scrollHeight - window.innerHeight);

      if (max <= SCROLLABLE_SLACK_PX || y <= ARM_AT_PX || y >= max - BOTTOM_ZONE_PX) {
        anchor = y;
        setHidden(false);
        return;
      }

      // A resize alone says nothing about direction — it only gets to force the
      // dock back via the checks above.
      if (!fromScroll) return;

      const delta = y - anchor;
      if (Math.abs(delta) < NOISE_PX) return;
      anchor = y;
      setHidden(delta > 0);
    }

    function onScroll(): void {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        evaluate(true);
      });
    }

    function onResize(): void {
      evaluate(false);
    }

    evaluate(false);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    // Content, not the viewport, is what usually changes height here — a
    // section collapsing, a filter tab switching, the day's items arriving.
    const observer = new ResizeObserver(onResize);
    observer.observe(document.body);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return hidden;
}
