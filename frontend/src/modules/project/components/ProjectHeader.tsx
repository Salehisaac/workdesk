import { ExclamationCircleOutline, LeftOutline, PieOutline } from 'antd-mobile-icons';
import { toPersianDigits } from '../../../shared/date/jalali';
import type { ReportStats } from '../report';
import type { ProjectDetail } from '../types';
import styles from './ProjectHeader.module.css';

interface ProjectHeaderProps {
  /** Null while the project is still loading — the bar keeps its shape anyway. */
  project: ProjectDetail | null;
  /** Overall stats for the inline meter; null until the jobs land. */
  stats: ReportStats | null;
  onBack: () => void;
  onOpenReport: () => void;
}

/**
 * The board's own header, in place of the plain NavBar it used to have.
 *
 * Two jobs. It identifies the project — avatar, name, how many people and how
 * much work are in it — and it is where «گزارش» lives. The meter under the
 * title is the report's headline number brought up onto the board: the state of
 * the project is worth a glance every time you open it, and it's what makes the
 * button next to it something you'd think to press.
 */
export function ProjectHeader({ project, stats, onBack, onOpenReport }: ProjectHeaderProps) {
  const showProgress = !!stats && stats.total > 0;

  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <button type="button" className={styles.back} onClick={onBack} aria-label="بازگشت">
          <LeftOutline />
        </button>

        {project?.avatarUrl ? (
          <img className={styles.avatar} src={project.avatarUrl} alt="" />
        ) : (
          <span className={styles.avatar} aria-hidden="true">
            {project?.name.trim().charAt(0) || '؟'}
          </span>
        )}

        <span className={styles.identity}>
          <span className={styles.name}>{project?.name ?? 'پروژه'}</span>
          <span className={styles.meta}>
            {toPersianDigits(project?.memberCount ?? 0)} عضو
            {stats && ` · ${toPersianDigits(stats.total)} کار`}
          </span>
        </span>

        <button
          type="button"
          className={styles.report}
          onClick={onOpenReport}
          disabled={!project}
          aria-label="گزارش پروژه"
        >
          <PieOutline className={styles.reportIcon} />
          گزارش
        </button>
      </div>

      {showProgress && (
        <div className={styles.progress}>
          <span className={styles.progressText}>
            <span className={styles.progressValue}>٪{toPersianDigits(stats.completion)}</span> انجام شده
          </span>

          <span
            className={styles.meter}
            role="img"
            aria-label={`${toPersianDigits(stats.done)} از ${toPersianDigits(stats.total)} کار انجام شده`}
          >
            <span className={styles.meterFill} style={{ width: `${stats.completion}%` }} />
          </span>

          {stats.overdue > 0 && (
            <span className={styles.overdue}>
              <ExclamationCircleOutline className={styles.overdueIcon} />
              {toPersianDigits(stats.overdue)} معوق
            </span>
          )}
        </div>
      )}
    </header>
  );
}
