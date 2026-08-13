import { DownOutline } from 'antd-mobile-icons';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import styles from './Report.module.css';

interface ReportSectionProps {
  icon: ReactNode;
  title: string;
  /** The one-line summary that stays visible when the section is folded shut. */
  hint?: string;
  /** Long lists fold; the two short summary sections stay open permanently. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * One card of the report. The «افراد» and «برچسب‌ها» sections can run to dozens
 * of rows, so they fold — and their `hint` is written to still answer the
 * headline question ("۴ نفر · ۱۲ کار") while shut, which is the whole point of
 * letting them close.
 */
export function ReportSection({
  icon,
  title,
  hint,
  collapsible = false,
  defaultOpen = true,
  children,
}: ReportSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const shown = !collapsible || open;

  const head = (
    <>
      <span className={styles.headIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.headText}>
        <span className={styles.headTitle}>{title}</span>
        {hint && <span className={styles.headHint}>{hint}</span>}
      </span>
      {collapsible && (
        <DownOutline className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} aria-hidden="true" />
      )}
    </>
  );

  return (
    <section className={styles.section}>
      {collapsible ? (
        <button
          type="button"
          className={`${styles.head} ${styles.headButton}`}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
        >
          {head}
        </button>
      ) : (
        <div className={styles.head}>{head}</div>
      )}

      {/* Unmounted rather than hidden: a folded section can hold a hundred rows,
          and none of them need to be in the tree (or in the tab order) to be
          reopened. */}
      {shown && (
        <div className={styles.body} id={bodyId}>
          {children}
        </div>
      )}
    </section>
  );
}
