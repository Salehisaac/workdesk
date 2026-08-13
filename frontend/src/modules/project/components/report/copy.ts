// The report's shared Persian phrasing. Kept out of report.ts on purpose: that
// module is arithmetic, and the moment copy lives beside it every wording tweak
// becomes a change to the file the numbers come from.
import { formatShortDate, toPersianDigits } from '../../../../shared/date/jalali';

/**
 * How far off a deadline is, in words. `daysToLastDue` is signed — past
 * deadlines come back negative — and the three cases read differently enough in
 * Persian that a single «۳ روز» would be ambiguous about which side of today
 * it falls on.
 */
export function describeGap(days: number | null): string {
  if (days === null) return '—';
  if (days === 0) return 'امروز';
  if (days > 0) return `${toPersianDigits(days)} روز مانده`;
  return `${toPersianDigits(-days)} روز گذشته`;
}

/** A deadline as «۲۱ مرداد», or a dash when there is none left to meet. */
export function describeDue(due: Date | null): string {
  return due ? formatShortDate(due) : '—';
}
