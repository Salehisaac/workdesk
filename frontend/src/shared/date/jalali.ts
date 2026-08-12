// The app's one Jalali date layer. Everything calendar-related goes through
// here so no component ever does its own Gregorian↔Jalali conversion.
//
// The actual calendar math (leap years, month lengths, weekday of a Jalali
// date) comes from date-fns-jalali — a zero-dependency fork of date-fns whose
// every function operates on the Jalali calendar while still taking/returning
// plain JS `Date`s. That last part is why it was picked over a UI date-picker
// package: the week↔month expansion this app needs is a custom interaction, so
// what we want from a dependency is the arithmetic, not a widget.
//
// Timezones: a `Date` here always means "midnight, local time, on that
// calendar day" — never a UTC instant. date-fns-jalali is local-time based
// throughout, so as long as days are created via startOfDay/addDays/etc. (and
// never via toISOString round-trips) a day can't slip to its neighbour.
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  getDate,
  getMonth,
  getYear,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns-jalali';
import { faIR } from 'date-fns-jalali/locale';

export { addDays, addMonths, isSameDay, isSameMonth, startOfDay, startOfMonth };

/** Saturday-first, matching the Persian week. Index === column index in the grid. */
export const WEEKDAY_LABELS_SHORT = ['شنبه', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'جمعه'] as const;

/** Same order, spelled out — used for aria-labels, not for display. */
export const WEEKDAY_LABELS_LONG = [
  'شنبه',
  'یک‌شنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
] as const;

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

/**
 * Stable per-calendar-day key (`jYYYY-jMM-jDD`), for indexing items by day.
 * Built from the Jalali field getters rather than format() — this runs once per
 * item per render pass, and the getters are an order of magnitude cheaper than
 * running the formatter's tokenizer.
 */
export function toDayKey(date: Date): string {
  const month = String(getMonth(date) + 1).padStart(2, '0');
  const day = String(getDate(date)).padStart(2, '0');
  return `${getYear(date)}-${month}-${day}`;
}

/** Today, normalized to local midnight. */
export function today(): Date {
  return startOfDay(new Date());
}

/** Column index (0 = شنبه … 6 = جمعه) of a date in the Persian week. */
export function weekdayIndex(date: Date): number {
  // JS getDay(): 0 = Sunday … 6 = Saturday. Saturday must map to 0.
  return (date.getDay() + 1) % 7;
}

/** Fridays are the Iranian weekend — rendered like a holiday in the grid. */
export function isWeekend(date: Date): boolean {
  return date.getDay() === 5;
}

/** «مرداد ۱۴۰۵» */
export function formatMonthYear(date: Date): string {
  return toPersianDigits(format(date, 'MMMM yyyy', { locale: faIR }));
}

/** «چهارشنبه ۲۱ مرداد ۱۴۰۵» */
export function formatLongDate(date: Date): string {
  return toPersianDigits(format(date, 'EEEE d MMMM yyyy', { locale: faIR }));
}

/** «۲۱ مرداد» */
export function formatShortDate(date: Date): string {
  return toPersianDigits(format(date, 'd MMMM', { locale: faIR }));
}

/** «۲۱» — the day-of-month number alone, for a calendar cell. */
export function formatDayNumber(date: Date): string {
  return toPersianDigits(getDate(date));
}

/** «۹:۰۵» — 24h, since Persian UIs don't use AM/PM. */
export function formatTime(date: Date): string {
  return toPersianDigits(format(date, 'H:mm'));
}

/** The Saturday that starts `date`'s week. */
export function startOfJalaliWeek(date: Date): Date {
  return startOfWeek(date, { locale: faIR });
}

/**
 * The full weeks covering `month`'s Jalali month, as rows of 7 local-midnight
 * days — including the leading/trailing days of the neighbouring months that
 * fill out the first and last rows. 5 or 6 rows depending on the month.
 */
export function buildMonthGrid(month: Date): Date[][] {
  const first = startOfJalaliWeek(startOfMonth(month));
  const last = endOfWeek(endOfMonth(month), { locale: faIR });
  const weeks: Date[][] = [];

  for (let cursor = first; cursor <= last; cursor = addDays(cursor, 1)) {
    const current = weeks[weeks.length - 1];
    if (!current || current.length === 7) weeks.push([cursor]);
    else current.push(cursor);
  }

  return weeks;
}

/** Index of the row in `weeks` containing `date`, or -1 when it isn't there. */
export function findWeekIndex(weeks: Date[][], date: Date): number {
  return weeks.findIndex((week) => week.some((day) => isSameDay(day, date)));
}
