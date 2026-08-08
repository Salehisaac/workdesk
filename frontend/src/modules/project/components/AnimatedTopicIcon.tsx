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
// confirmed against a real one from this platform's own getForumTopicIconStickers.
// With 100+ icons in the picker grid (see CreateListSheet), eagerly fetching
// and animating every single one at once would be a real perf hit on
// low/mid-end Android WebViews (the plan's binding constraint) — this only
// fetches/renders once its container is actually scrolled into view, then
// leaves the player running (no repeated mount/unmount thrashing on scroll).
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
