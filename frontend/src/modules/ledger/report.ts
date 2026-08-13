/**
 * The arithmetic behind every ledger screen.
 *
 * No `/ledgers/:id/report` endpoint exists, for the same reason the project
 * report has none: a report is a *view* of rows the cache is already holding.
 * GET /ledgers/:id brings the whole book down once, and each of the five
 * periods — plus the three tabs, plus the filter — is a cut of that same array,
 * computed here. Which means «هفته قبل» is a re-render, not a round trip, and
 * the book and its report can never disagree about a number.
 *
 * Every range is a half-open interval of local-midnight days, [start, end): the
 * only way two neighbouring periods can neither overlap on a boundary day nor
 * drop one between them.
 */
import {
  addDays,
  addMonths,
  addYears,
  formatMonthYear,
  formatNumericDate,
  formatYear,
  startOfDay,
  startOfJalaliWeek,
  startOfMonth,
  startOfYear,
} from '../../shared/date/jalali';
import { ACCOUNT_GROUPS } from './types';
import type { AccountGroup, LedgerTransaction, TransactionType } from './types';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export const REPORT_PERIODS: ReportPeriod[] = ['daily', 'weekly', 'monthly', 'yearly', 'custom'];

export const REPORT_PERIOD_LABEL: Record<ReportPeriod, string> = {
  daily: 'روزانه',
  weekly: 'هفتگی',
  monthly: 'ماهانه',
  yearly: 'سالانه',
  custom: 'انتخابی',
};

/**
 * What the two arrows either side of the date are called. «انتخابی» has no
 * entry because it has no arrows: a range someone chose by hand has no natural
 * next one, so that screen offers its two dates instead.
 */
export const PERIOD_STEP_LABEL: Record<Exclude<ReportPeriod, 'custom'>, { previous: string; next: string }> = {
  daily: { previous: 'روز قبل', next: 'روز بعد' },
  weekly: { previous: 'هفته قبل', next: 'هفته بعد' },
  monthly: { previous: 'ماه قبل', next: 'ماه بعد' },
  yearly: { previous: 'سال قبل', next: 'سال بعد' },
};

export function isReportPeriod(value: string | null): value is ReportPeriod {
  return !!value && (REPORT_PERIODS as string[]).includes(value);
}

/** Half-open: `start` is included, `end` is not. */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * The period `anchor` falls in. For «انتخابی» the caller already has the two
 * days the user picked, so it passes them through — with `end` pushed to the
 * following midnight, since a range chosen as «تا ۲۲ مرداد» means that day is
 * in it.
 */
export function rangeFor(period: ReportPeriod, anchor: Date, custom?: DateRange): DateRange {
  switch (period) {
    case 'daily': {
      const start = startOfDay(anchor);
      return { start, end: addDays(start, 1) };
    }
    case 'weekly': {
      const start = startOfJalaliWeek(anchor);
      return { start, end: addDays(start, 7) };
    }
    case 'monthly': {
      const start = startOfMonth(anchor);
      return { start, end: startOfMonth(addMonths(start, 1)) };
    }
    case 'yearly': {
      const start = startOfYear(anchor);
      return { start, end: startOfYear(addYears(start, 1)) };
    }
    case 'custom': {
      const start = startOfDay(custom?.start ?? anchor);
      const last = startOfDay(custom?.end ?? anchor);
      // A backwards range would silently show nothing; read it as the day the
      // user tapped first instead.
      const end = last < start ? addDays(start, 1) : addDays(last, 1);
      return { start, end };
    }
  }
}

/** The same period, `direction` steps away (−1 = previous, +1 = next). */
export function stepAnchor(period: ReportPeriod, anchor: Date, direction: 1 | -1): Date {
  switch (period) {
    case 'daily':
      return addDays(anchor, direction);
    case 'weekly':
      return addDays(anchor, 7 * direction);
    case 'monthly':
      return addMonths(anchor, direction);
    case 'yearly':
      return addYears(anchor, direction);
    case 'custom':
      return anchor;
  }
}

/** What the header prints between the two arrows. */
export function formatRangeLabel(period: ReportPeriod, range: DateRange): string {
  switch (period) {
    case 'daily':
    case 'weekly':
      // The week wears its first day (a Saturday) rather than a span: two dates
      // in a header that already carries «هفته قبل»/«هفته بعد» is more reading
      // for the same information.
      return formatNumericDate(range.start);
    case 'monthly':
      return formatMonthYear(range.start);
    case 'yearly':
      return formatYear(range.start);
    case 'custom':
      return `${formatNumericDate(range.start)} تا ${formatNumericDate(addDays(range.end, -1))}`;
  }
}

export function inRange(transaction: LedgerTransaction, range: DateRange): boolean {
  const at = new Date(transaction.occurredAt).getTime();
  return at >= range.start.getTime() && at < range.end.getTime();
}

export interface LedgerTotals {
  income: number;
  expense: number;
  /** income − expense. Negative is an ordinary outcome, not an error state. */
  balance: number;
}

export function totalsOf(transactions: LedgerTransaction[]): LedgerTotals {
  let income = 0;
  let expense = 0;
  for (const transaction of transactions) {
    if (transaction.type === 'expense') expense += transaction.amount;
    else income += transaction.amount;
  }
  return { income, expense, balance: income - expense };
}

export interface GroupSlice {
  group: AccountGroup;
  amount: number;
  /** 0–1 of the side's total. Zero when the side is empty. */
  share: number;
}

/**
 * One side of the book, split by «گروه حساب».
 *
 * Returned in the fixed ACCOUNT_GROUPS order and NOT sorted by amount —
 * deliberately, and it matters twice. The donut paints its arcs in this order,
 * so which colours end up next to each other is fixed by the category list
 * rather than by this month's numbers (the palette was checked for exactly that
 * adjacency); and a group keeps its colour when a filter changes what else is on
 * screen, because colour follows the category, never its rank.
 *
 * Empty groups are dropped — a legend row reading «٪۰ پاداش» is noise, and a
 * zero-length arc is nothing at all.
 */
export function breakdownByGroup(transactions: LedgerTransaction[], type: TransactionType): GroupSlice[] {
  const amounts = new Map<AccountGroup, number>();
  let total = 0;

  for (const transaction of transactions) {
    if (transaction.type !== type) continue;
    amounts.set(transaction.accountGroup, (amounts.get(transaction.accountGroup) ?? 0) + transaction.amount);
    total += transaction.amount;
  }

  return ACCOUNT_GROUPS.filter((group) => (amounts.get(group) ?? 0) > 0).map((group) => {
    const amount = amounts.get(group) ?? 0;
    return { group, amount, share: total === 0 ? 0 : amount / total };
  });
}

/**
 * What the report screen's filter narrows to. Empty arrays mean "no opinion",
 * which is the state the sheet opens in — a filter nobody has touched must not
 * hide anything.
 */
export interface TransactionFilter {
  groups: AccountGroup[];
  sourceIds: string[];
  tagIds: string[];
}

export const EMPTY_FILTER: TransactionFilter = { groups: [], sourceIds: [], tagIds: [] };

export function isFilterActive(filter: TransactionFilter): boolean {
  return filter.groups.length > 0 || filter.sourceIds.length > 0 || filter.tagIds.length > 0;
}

export function applyFilter(transactions: LedgerTransaction[], filter: TransactionFilter): LedgerTransaction[] {
  if (!isFilterActive(filter)) return transactions;

  return transactions.filter((transaction) => {
    if (filter.groups.length > 0 && !filter.groups.includes(transaction.accountGroup)) return false;
    if (filter.sourceIds.length > 0 && (!transaction.sourceId || !filter.sourceIds.includes(transaction.sourceId))) {
      return false;
    }
    // Any one of the chosen tags is enough: the sheet reads as "show me these",
    // not "show me rows carrying all of these at once".
    if (filter.tagIds.length > 0 && !transaction.tagIds.some((id) => filter.tagIds.includes(id))) return false;
    return true;
  });
}
