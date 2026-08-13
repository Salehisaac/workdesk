import { DownOutline } from 'antd-mobile-icons';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { toPersianDigits } from '../../../shared/date/jalali';
import type { AgendaItem, AgendaSectionKey } from '../types';
import { AgendaItemCard } from './AgendaItemCard';
import styles from './AgendaSection.module.css';

interface AgendaSectionProps {
  group: AgendaSectionKey;
  title: string;
  icon: ReactNode;
  /** Shown in place of the list when the selected day has nothing of this kind. */
  emptyText: string;
  /**
   * One line above the cards, when the section has something to say about them
   * as a set — «۲ مورد معوقه دارید!». Dropped when the section is empty, where
   * `emptyText` is already the whole message.
   */
  headline?: string;
  items: AgendaItem[];
}

export function AgendaSection({ group, title, icon, emptyText, headline, items }: AgendaSectionProps) {
  // Open by default, including when empty: the empty line is the answer to
  // "what's on today", so hiding it behind a tap would defeat the point.
  const [open, setOpen] = useState(true);
  const bodyId = `agenda-section-${group}`;

  return (
    <section className={styles.section} data-group={group}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        <span className={styles.icon}>{icon}</span>
        <span className={styles.title}>{title}</span>
        {items.length > 0 && <span className={styles.count}>{toPersianDigits(items.length)}</span>}
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
          <DownOutline />
        </span>
      </button>

      {open && (
        <div className={styles.body} id={bodyId}>
          {items.length === 0 ? (
            <p className={styles.empty}>{emptyText}</p>
          ) : (
            <>
              {headline && <p className={styles.headline}>{headline}</p>}
              {items.map((item) => (
                <AgendaItemCard key={item.id} item={item} />
              ))}
            </>
          )}
        </div>
      )}
    </section>
  );
}
