import type { CSSProperties } from 'react';
import { toPersianDigits } from '../../../../shared/date/jalali';
import { JOB_STATUS_LABEL } from '../../types';
import type { StatusSlice } from '../../report';
import { STATUS_ICON } from '../statusIcon';
import styles from './Report.module.css';

/** `--wd-segment-color` is what both the bar segment and its legend mark read. */
function statusStyle(status: string): CSSProperties {
  return { '--wd-segment-color': `var(--wd-status-${status})` } as CSSProperties;
}

interface StatusBreakdownProps {
  slices: StatusSlice[];
  total: number;
}

/**
 * Where the whole project's work stands, as one stacked bar plus the legend
 * that also serves as the by-status table.
 *
 * Deliberately not a pie. Six statuses, several of them usually close in size,
 * is the comparison a pie is worst at — and a two-slice "done vs not" pie says
 * less than the number above it does. A single stacked bar keeps every share on
 * one common baseline, and the rows below it carry the exact counts, so nothing
 * has to be estimated off an angle.
 */
export function StatusBreakdown({ slices, total }: StatusBreakdownProps) {
  return (
    <>
      {total === 0 ? (
        <div className={styles.barEmpty} aria-hidden="true" />
      ) : (
        <div
          className={styles.bar}
          role="img"
          aria-label={slices
            .filter((slice) => slice.count > 0)
            .map((slice) => `${JOB_STATUS_LABEL[slice.status]}: ${toPersianDigits(slice.count)}`)
            .join('، ')}
        >
          {slices
            .filter((slice) => slice.count > 0)
            .map((slice) => (
              <span
                key={slice.status}
                className={styles.segment}
                // flexGrow, not a width percentage: the 2px gaps between
                // segments come out of the same row, so shares that add to 100%
                // would overflow it. Growing by count lets flex hand out
                // whatever is left after the gaps, in the right proportions.
                style={{ ...statusStyle(slice.status), flexGrow: slice.count }}
              />
            ))}
        </div>
      )}

      <ul className={styles.legend}>
        {slices.map((slice) => (
          <li
            key={slice.status}
            className={`${styles.legendRow} ${slice.count === 0 ? styles.legendRowEmpty : ''}`}
          >
            <span className={styles.legendMark} style={statusStyle(slice.status)} aria-hidden="true">
              {STATUS_ICON[slice.status]}
            </span>
            <span className={styles.legendLabel}>{JOB_STATUS_LABEL[slice.status]}</span>
            <span className={styles.legendCount}>{toPersianDigits(slice.count)} کار</span>
            <span className={styles.legendShare}>٪{toPersianDigits(slice.share)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
