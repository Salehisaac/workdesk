import { ActionSheet } from 'antd-mobile';
import { MoreOutline } from 'antd-mobile-icons';
import { forwardRef, useState } from 'react';
import { toPersianDigits } from '../../../../shared/date/jalali';
import { AnimatedTopicIcon } from '../AnimatedTopicIcon';
import type { Job, ProjectListItem } from '../../types';
import { JobCard } from './JobCard';
import styles from './ListColumn.module.css';

interface ListColumnProps {
  list: ProjectListItem;
  jobs: Job[];
  isActive: boolean;
  loading: boolean;
  onDelete: () => void;
}

/**
 * One list as a full-width page of the board: its own header, its own vertical
 * scroll, its own jobs. The neighbouring list peeks in at the edge so it's
 * visible that the board pages sideways.
 */
export const ListColumn = forwardRef<HTMLElement, ListColumnProps>(function ListColumn(
  { list, jobs, isActive, loading, onDelete },
  ref,
) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <section
      className={styles.column}
      ref={ref}
      // Read back by the board's IntersectionObserver — an entry only carries
      // the element, so the list id has to travel on it.
      data-list-id={list.id}
      aria-label={`لیست ${list.name}`}
      data-active={isActive}
    >
      <header className={styles.header}>
        <span className={styles.name}>
          {list.iconEmoji &&
            (list.iconFileId ? (
              <AnimatedTopicIcon fileId={list.iconFileId} fallbackEmoji={list.iconEmoji} size={18} />
            ) : (
              <span className={styles.icon}>{list.iconEmoji}</span>
            ))}
          {list.name}
        </span>

        {jobs.length > 0 && <span className={styles.count}>{toPersianDigits(jobs.length)}</span>}

        {/* A sheet rather than a popover: the ⋮ lives inside the horizontally
            scrolled board, where popper anchors itself to the wrong edge under
            RTL. A bottom sheet has nothing to anchor to, and it's the pattern
            the rest of the app already uses for actions. */}
        <button
          type="button"
          className={styles.menu}
          aria-label={`گزینه‌های لیست ${list.name}`}
          onClick={() => setMenuOpen(true)}
        >
          <MoreOutline />
        </button>
      </header>

      <ActionSheet
        visible={menuOpen}
        actions={[{ key: 'delete', text: 'حذف لیست', danger: true }]}
        cancelText="انصراف"
        onClose={() => setMenuOpen(false)}
        onMaskClick={() => setMenuOpen(false)}
        onAction={() => {
          setMenuOpen(false);
          onDelete();
        }}
      />

      {/* Accent only on the page you're on — the one cue that says which of the
          side-by-side lists is the active one. */}
      <span className={styles.rule} />

      <div className={styles.jobs}>
        {loading && jobs.length === 0 && <p className={styles.empty}>در حال بارگذاری…</p>}
        {!loading && jobs.length === 0 && <p className={styles.empty}>هنوز کاری در این لیست نیست.</p>}
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </section>
  );
});
