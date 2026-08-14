import { ExclamationCircleOutline, LeftOutline, PieOutline, QuestionCircleOutline, SetOutline } from 'antd-mobile-icons';
import { useState } from 'react';
import { toPersianDigits } from '../../../shared/date/jalali';
import type { ReportStats } from '../report';
import type { ProjectDetail } from '../types';
import { ProjectsGuideSheet } from './ProjectsGuideSheet';
import styles from './ProjectHeader.module.css';

interface ProjectHeaderProps {
  /** Null while the project is still loading — the bar keeps its shape anyway. */
  project: ProjectDetail | null;
  /** Overall stats for the inline meter; null until the jobs land. */
  stats: ReportStats | null;
  onBack: () => void;
  onOpenReport: () => void;
  /**
   * Opens the edit screen. Undefined for everyone but the project's creator —
   * the only one the API lets rename or delete it — so the button simply isn't
   * there rather than being there and refused.
   */
  onEdit?: () => void;
}

/**
 * The board's own header, in place of the plain NavBar it used to have.
 *
 * Three jobs. It identifies the project — avatar, name, how many people and how
 * much work are in it — and it is where «گزارش» and «درباره» live. The meter
 * under the title is the report's headline number brought up onto the board:
 * the state of the project is worth a glance every time you open it, and it's
 * what makes the button next to it something you'd think to press.
 *
 * «راهنما» is the icon and «گزارش» the labelled pill, not the other way round:
 * a chart glyph alone doesn't read as "progress", whereas ? is about the only
 * icon that needs no label at all — and only one of the two can carry words
 * before the project's name starts getting squeezed. The guide it opens is
 * about the *service*, not this project, so it takes nothing from here.
 */
export function ProjectHeader({ project, stats, onBack, onOpenReport, onEdit }: ProjectHeaderProps) {
  const [guideOpen, setGuideOpen] = useState(false);
  const showProgress = !!stats && stats.total > 0;

  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <button type="button" className={styles.back} onClick={onBack} aria-label="بازگشت">
          <LeftOutline />
        </button>

        {/* No home button here, unlike the other screens this deep (see
            shared/ui/HomeButton). It was tried and measured: it costs 46px of
            the title, which drops «بازطراحی فروشگاه» — an ordinary-length name —
            into an ellipsis. The board is also the one deep screen nobody can
            arrive at cold, since a project announces itself through its Rasagram
            group rather than through a link into the app, so whoever is here
            walked down from «پروژه‌ها» and back retraces a path they took. */}
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

        {/* Only the creator gets this, so for everyone else the row is exactly
            what it was — no icon spending the title's width on something they
            can't use. An icon and not a labelled pill for the same reason the
            guide is one: «گزارش» is the only word this row can afford. */}
        {onEdit && (
          <button
            type="button"
            className={styles.info}
            onClick={onEdit}
            disabled={!project}
            aria-label="ویرایش پروژه"
          >
            <SetOutline />
          </button>
        )}

        {/* Not disabled while the project loads, unlike the other two: the guide
            explains the service and needs no project to be ready. */}
        <button
          type="button"
          className={styles.info}
          onClick={() => setGuideOpen(true)}
          aria-label="راهنمای پروژه‌ها"
        >
          <QuestionCircleOutline />
        </button>

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

      {/* Mounted only once opened: it's a screenful of guide text, and none of
          it needs to be in the tree behind a board the user is working on. */}
      {guideOpen && <ProjectsGuideSheet visible={guideOpen} onClose={() => setGuideOpen(false)} />}
    </header>
  );
}
