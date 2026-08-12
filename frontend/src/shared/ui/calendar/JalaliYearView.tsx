import { useMemo } from 'react';
import {
  addMonths,
  buildMonthGrid,
  formatDayNumber,
  formatLongDate,
  formatMonthYear,
  isSameDay,
  isSameMonth,
  isWeekend,
  startOfMonth,
  toDayKey,
  toPersianDigits,
} from '../../date/jalali';
import styles from './JalaliYearView.module.css';

const MONTHS_IN_YEAR = 12;

interface JalaliYearViewProps {
  /** Any day in the year to show — the whole Jalali year around it is rendered. */
  year: Date;
  selectedDate: Date;
  today: Date;
  onSelectDate: (date: Date) => void;
}

/**
 * All twelve Jalali months at once, for picking a deadline that isn't in the
 * month you're looking at. Days are laid out in reading order rather than in a
 * Saturday-aligned grid: at this size the weekday columns are unreadable
 * anyway, and what the view is for is "find مهر, tap the 14th" — the month's
 * own shape, not which weekday a date lands on.
 */
export function JalaliYearView({ year, selectedDate, today, onSelectDate }: JalaliYearViewProps) {
  const yearKey = toDayKey(year).slice(0, 4);

  const months = useMemo(() => {
    // Farvardin of `year`'s Jalali year, then the eleven that follow it.
    const firstMonth = addMonths(startOfMonth(year), -(Number(toDayKey(year).slice(5, 7)) - 1));
    return Array.from({ length: MONTHS_IN_YEAR }, (_, index) => {
      const month = addMonths(firstMonth, index);
      // buildMonthGrid pads with the neighbouring months' days to fill whole
      // weeks; here only this month's own days are wanted.
      const days = buildMonthGrid(month)
        .flat()
        .filter((day) => isSameMonth(day, month));
      return { month, days };
    });
  }, [yearKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.year}>
      <div className={styles.yearTitle}>{toPersianDigits(yearKey)}</div>

      <div className={styles.grid}>
        {months.map(({ month, days }) => (
          <section key={toDayKey(month)} className={styles.month}>
            <h3 className={styles.monthName}>{formatMonthYear(month).replace(` ${toPersianDigits(yearKey)}`, '')}</h3>
            <div className={styles.days}>
              {days.map((day) => {
                const isSelected = isSameDay(day, selectedDate);
                return (
                  <button
                    key={toDayKey(day)}
                    type="button"
                    className={[
                      styles.day,
                      isSelected ? styles.daySelected : '',
                      isSameDay(day, today) ? styles.dayToday : '',
                      isWeekend(day) ? styles.dayWeekend : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-label={formatLongDate(day)}
                    aria-selected={isSelected}
                    aria-current={isSameDay(day, today) ? 'date' : undefined}
                    onClick={() => onSelectDate(day)}
                  >
                    {formatDayNumber(day)}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
