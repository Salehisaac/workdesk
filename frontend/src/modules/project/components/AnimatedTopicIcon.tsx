import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTopicIconAnimation } from '../api';
import styles from './AnimatedTopicIcon.module.css';

interface AnimatedTopicIconProps {
  /** The chosen icon's file_id (ProjectListItem.iconFileId / TopicIcon.fileId). */
  fileId: string;
  /** Shown immediately, and kept as the permanent fallback if the animation fails to load. */
  fallbackEmoji: string;
  size?: number;
}

// Real Telegram renders topic icons as animated Lottie stickers (.tgs) —
// confirmed against a real one from this platform's own
// getForumTopicIconStickers.
//
// One of these is not cheap: a request, a Lottie parse, an SVG tree, and a
// requestAnimationFrame loop that runs for as long as it is mounted. So it is
// used only where a *chosen* icon is shown — a list's header on the board, and
// the trigger in CreateListSheet — never for a gridful of candidates. The
// picker's grid renders plain emoji instead, and CreateListSheet says why: a
// screenful of these at once froze the app on the low/mid-end Android WebViews
// that are the plan's binding constraint.
//
// The observer is what keeps even those few honest: nothing is fetched or
// rendered until it is actually scrolled into view, and the player is left
// running afterwards rather than thrashed on every scroll.
export function AnimatedTopicIcon({ fileId, fallbackEmoji, size = 28 }: AnimatedTopicIconProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || inView) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { rootMargin: '150px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView]);

  const animation = useTopicIconAnimation(fileId, inView);

  useEffect(() => {
    if (!animation.data || !containerRef.current) return;
    let item: import('lottie-web').AnimationItem | undefined;
    let cancelled = false;

    import('lottie-web').then(({ default: lottie }) => {
      if (cancelled || !containerRef.current) return;
      item = lottie.loadAnimation({
        container: containerRef.current,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: animation.data,
      });
    });

    return () => {
      cancelled = true;
      item?.destroy();
    };
  }, [animation.data]);

  return (
    <div ref={containerRef} className={styles.wrap} style={{ '--icon-size': `${size}px` } as CSSProperties}>
      {!animation.data && <span className={styles.fallback}>{fallbackEmoji}</span>}
    </div>
  );
}
