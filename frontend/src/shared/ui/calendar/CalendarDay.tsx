import { memo } from 'react';
import type { KeyboardEvent } from 'react';
import { formatDayNumber, formatLongDate } from '../../date/jalali';
import styles from './Calendar.module.css';
import type { CalendarMarker } from './types';

/** More than this and the dots stop reading as "a few things" and start as noise. */
const MAX_VISIBLE_MARKERS = 3;

interface CalendarDayProps {
  date: Date;
  dayKey: string;
  isSelected: boolean;
  isToday: boolean;
  /** Belongs to the previous/next month — the filler days of the first/last row. */
  isOutsideMonth: boolean;
  isWeekend: boolean;
  markers: readonly CalendarMarker[];
  /** -1 for every day but the selected one: one tab stop for the whole grid. */
  tabIndex: number;
  onSelect: (date: Date) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, date: Date) => void;
}

function CalendarDayImpl({
  date,
  dayKey,
  isSelected,
  isToday,
  isOutsideMonth,
  isWeekend,
  markers,
  tabIndex,
  onSelect,
  onKeyDown,
}: CalendarDayProps) {
  const visible = markers.slice(0, MAX_VISIBLE_MARKERS);

  // Everything the circle communicates visually, spelled out — the selected and
  // today states are colour+shape on screen, and the dots are colour only.
  const label = [
    formatLongDate(date),
    isToday ? 'امروز' : null,
    markers.length > 0 ? markers.map((marker) => marker.label).join('، ') : null,
  ]
    .filter(Boolean)
    .join('، ');

  const className = [
    styles.day,
    isSelected ? styles.daySelected : '',
    isToday ? styles.dayToday : '',
    isOutsideMonth ? styles.dayOutside : '',
    isWeekend ? styles.dayWeekend : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      role="gridcell"
      data-day={dayKey}
      className={className}
      aria-label={label}
      aria-selected={isSelected}
      aria-current={isToday ? 'date' : undefined}
      tabIndex={tabIndex}
      onClick={() => onSelect(date)}
      onKeyDown={(event) => onKeyDown(event, date)}
    >
      <span className={styles.dayNumber}>{formatDayNumber(date)}</span>
      <span className={styles.dayMarkers} aria-hidden="true">
        {visible.map((marker) => (
          <span key={marker.id} className={styles.dayMarker} style={{ background: marker.color }} />
        ))}
      </span>
    </button>
  );
}

// The month grid is 42 of these and re-renders on every drag frame while the
// calendar is being pulled open — without memo that's 42 reconciliations per
// animation frame for cells whose props never changed.
export const CalendarDay = memo(CalendarDayImpl);
