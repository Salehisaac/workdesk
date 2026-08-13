import { CalendarOutline, CheckCircleOutline, ExclamationCircleOutline } from 'antd-mobile-icons';
import type { CSSProperties } from 'react';
import { toPersianDigits } from '../../../../shared/date/jalali';
import type { ReportGroup } from '../../report';
import { tagColor } from '../job/tagColor';
import { describeDue, describeGap } from './copy';
import styles from './Report.module.css';

interface GroupRowProps {
  group: ReportGroup;
  /** People get an initial-avatar, tags get their colour swatch. */
  kind: 'member' | 'tag';
}

/**
 * One person's or one tag's slice of the project.
 *
 * A meter rather than another stacked bar: at this level the question is "how
 * far along is this one bucket", a single ratio against its own total, and a
 * six-segment strip repeated down a list of twenty people is unreadable on a
 * phone. The exact counts ride below it as chips, so nothing is only encoded in
 * the bar's length.
 */
export function GroupRow({ group, kind }: GroupRowProps) {
  const { stats } = group;
  // The meter is a completion measure, so it wears the «انجام شده» colour —
  // the same green that status means everywhere else in the app.
  const meterStyle = { '--wd-meter-color': 'var(--wd-status-done)' } as CSSProperties;

  return (
    <div className={styles.group}>
      <div className={styles.groupHead}>
        {kind === 'tag' ? (
          <span
            className={`${styles.swatch} ${group.synthetic ? styles.swatchSynthetic : ''}`}
            // Same fallback the board's chips use, so a colourless tag is the
            // same colour here as it is on the card it came from.
            style={
              group.synthetic
                ? undefined
                : ({ '--wd-group-color': group.color ?? tagColor(group.name) } as CSSProperties)
            }
            aria-hidden="true"
          />
        ) : (
          <span
            className={`${styles.avatar} ${group.synthetic ? styles.avatarSynthetic : ''}`}
            aria-hidden="true"
          >
            {group.synthetic ? '؟' : group.name.trim().charAt(0) || '؟'}
          </span>
        )}

        <span className={styles.groupName}>{group.name}</span>
        <span className={styles.groupPercent}>٪{toPersianDigits(stats.completion)}</span>
      </div>

      <div
        className={styles.meter}
        style={meterStyle}
        role="img"
        aria-label={`${toPersianDigits(stats.done)} از ${toPersianDigits(stats.total)} کار انجام شده`}
      >
        <span className={styles.meterFill} style={{ width: `${stats.completion}%` }} />
      </div>

      <div className={styles.facts}>
        <span className={styles.fact}>
          <CheckCircleOutline className={styles.factIcon} />
          <span className={styles.factValue}>
            {toPersianDigits(stats.done)}/{toPersianDigits(stats.total)}
          </span>
          کار
        </span>

        {/* Only when there is something to act on — a row of «۰ معوق» chips
            down a long list is noise that hides the rows that aren't zero. */}
        {stats.overdue > 0 && (
          <span className={`${styles.fact} ${styles.factAlert}`}>
            <ExclamationCircleOutline className={styles.factIcon} />
            <span className={styles.factValue}>{toPersianDigits(stats.overdue)}</span>
            معوق
          </span>
        )}

        {stats.lastDue && (
          <span className={styles.fact}>
            <CalendarOutline className={styles.factIcon} />
            <span className={styles.factValue}>{describeDue(stats.lastDue)}</span>
            {describeGap(stats.daysToLastDue)}
          </span>
        )}
      </div>
    </div>
  );
}
