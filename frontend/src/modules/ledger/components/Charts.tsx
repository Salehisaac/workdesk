import type { CSSProperties } from 'react';
import { toPersianDigits } from '../../../shared/date/jalali';
import { formatMoney, formatPercent, formatToman } from '../money';
import type { GroupSlice } from '../report';
import { ACCOUNT_GROUP_LABEL } from '../types';
import type { AccountGroup, TransactionType } from '../types';
import styles from './Charts.module.css';

/**
 * The colour a «گروه حساب» wears, everywhere it appears.
 *
 * Keyed by the category, never by its position in a sorted list — so «حقوق» is
 * the same orange whether it is this month's largest slice or its smallest, and
 * filtering rows out never repaints the ones that survive. The values live in
 * shared/styles/tokens.css, where the reasoning about colour-vision safety is
 * written down.
 */
export function groupColor(group: AccountGroup): string {
  return `var(--wd-ledger-group-${group})`;
}

interface BalanceBarsProps {
  income: number;
  expense: number;
}

/**
 * «مجموع» — the two directions, side by side, and what is left.
 *
 * Two bars on ONE scale (the larger of the two is full height): the whole point
 * of the picture is which of them is bigger and by how much, and two scales —
 * or two independently-full bars — would answer that question wrongly while
 * looking like they had answered it.
 *
 * Neither bar is identified by its colour alone: each carries its own words and
 * its own figure directly above it. That is what makes the conventional
 * green/red safe to use for readers who can't tell green from red.
 */
export function BalanceBars({ income, expense }: BalanceBarsProps) {
  const largest = Math.max(income, expense);
  // A non-zero amount that rounds to a hairline still has to be visible as a
  // bar — otherwise «۵۰ تومان» beside «۵۰,۰۰۰,۰۰۰ تومان» reads as nothing at all.
  const height = (amount: number) => (largest === 0 ? 0 : Math.max((amount / largest) * 100, amount > 0 ? 3 : 0));

  return (
    <figure
      className={styles.bars}
      role="img"
      aria-label={`مجموع درآمد ${formatToman(income)}، مجموع هزینه ${formatToman(expense)}، موجودی ${formatToman(income - expense)}`}
    >
      <div className={styles.plot}>
        <div className={styles.column}>
          <span className={`${styles.columnLabel} ${styles.income}`}>مجموع درآمد</span>
          <span className={`${styles.columnValue} ${styles.income}`}>{formatMoney(income)}</span>
          <span className={styles.track}>
            <span className={`${styles.fill} ${styles.fillIncome}`} style={{ height: `${height(income)}%` } as CSSProperties} />
          </span>
        </div>

        <div className={styles.column}>
          <span className={`${styles.columnLabel} ${styles.expense}`}>مجموع هزینه</span>
          <span className={`${styles.columnValue} ${styles.expense}`}>{formatMoney(expense)}</span>
          <span className={styles.track}>
            <span className={`${styles.fill} ${styles.fillExpense}`} style={{ height: `${height(expense)}%` } as CSSProperties} />
          </span>
        </div>
      </div>

      {/* The number the whole screen exists for, so it is a caption rather than
          a third bar: a balance is a difference, not a quantity of the same kind
          as the two above it, and giving it a bar would invite reading it off
          the same scale. */}
      <figcaption className={styles.balance}>
        <span className={styles.balanceLabel}>موجودی</span>
        <span className={styles.balanceValue} data-negative={income - expense < 0 || undefined}>
          {formatToman(income - expense)}
        </span>
      </figcaption>
    </figure>
  );
}

interface GroupDonutProps {
  slices: GroupSlice[];
  total: number;
  type: TransactionType;
}

// Geometry of the ring, in the SVG's own units. The gap is what keeps two
// neighbouring arcs from reading as one; 2 units at this radius is the ~2px
// surface gap the mark spec asks for.
const RADIUS = 76;
const STROKE = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_GAP = 2;

/**
 * «درآمدها» / «هزینه‌ها» — one side of the book, split by account group.
 *
 * A donut is the right form here for the reason it is usually the wrong one:
 * there are at most five parts, they genuinely sum to a meaningful whole (this
 * side's total), and the total belongs in the middle where the eye already is.
 *
 * The legend under it is not decoration — it is the table view. Three of the
 * group colours sit below 3:1 against a light background, which is allowed only
 * where the figures are also readable as text, so every group's amount and
 * share are printed there in ordinary ink.
 */
export function GroupDonut({ slices, total, type }: GroupDonutProps) {
  const label = type === 'income' ? 'مجموع درآمد' : 'مجموع هزینه';
  // With one slice there is no neighbour to be separated from, and a gap would
  // just be a nick cut out of a full ring.
  const gap = slices.length > 1 ? ARC_GAP : 0;

  let offset = 0;

  return (
    <figure className={styles.donutFigure}>
      <div className={styles.donutWrap}>
        <svg
          className={styles.donut}
          viewBox="0 0 200 200"
          role="img"
          aria-label={`${label} ${formatToman(total)}، به تفکیک گروه حساب`}
        >
          {/* The unspent ring: without it a book with one small group would draw
              a stub floating in space instead of a part of a whole. */}
          <circle className={styles.donutTrack} cx="100" cy="100" r={RADIUS} strokeWidth={STROKE} fill="none" />

          {slices.map((slice) => {
            const length = slice.share * CIRCUMFERENCE;
            const dash = Math.max(length - gap, 0.5);
            const arc = (
              <circle
                key={slice.group}
                cx="100"
                cy="100"
                r={RADIUS}
                fill="none"
                stroke={groupColor(slice.group)}
                strokeWidth={STROKE}
                strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                strokeDashoffset={-offset}
                // Starts the ring at twelve o'clock instead of three.
                transform="rotate(-90 100 100)"
              >
                <title>{`${ACCOUNT_GROUP_LABEL[slice.group]} — ${formatToman(slice.amount)}`}</title>
              </circle>
            );
            offset += length;
            return arc;
          })}
        </svg>

        {/* HTML, not <text>: this is Persian prose on two lines, and the layout
            engine handles that far better than manual SVG baselines would. */}
        <div className={styles.donutCenter}>
          <span className={`${styles.donutCenterLabel} ${type === 'income' ? styles.income : styles.expense}`}>
            {label}
          </span>
          <span className={`${styles.donutCenterValue} ${type === 'income' ? styles.income : styles.expense}`}>
            {formatMoney(total)}
          </span>
        </div>
      </div>

      <figcaption className={styles.legend}>
        {slices.map((slice) => (
          <div key={slice.group} className={styles.legendRow}>
            <span className={styles.legendSwatch} style={{ background: groupColor(slice.group) } as CSSProperties} aria-hidden="true" />
            <span className={styles.legendName}>{ACCOUNT_GROUP_LABEL[slice.group]}</span>
            <span className={styles.legendShare}>{formatPercent(slice.share)}</span>
            <span className={styles.legendAmount}>{formatMoney(slice.amount)}</span>
          </div>
        ))}
      </figcaption>
    </figure>
  );
}

/** «۳ تراکنش» — the count under a chart, spelled the one way. */
export function transactionCount(count: number): string {
  return `${toPersianDigits(count)} تراکنش`;
}
