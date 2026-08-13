// The module's one money layer. Every figure on every ledger screen is printed
// through here, so «۱,۲۰۰,۰۰۰ تومان» is spelled exactly one way.
import { fromPersianDigits, toPersianDigits } from '../../shared/date/jalali';

/** Above this an input has stopped being a price and is almost certainly a slip. */
const MAX_AMOUNT = 9_999_999_999_999;

/**
 * «۱,۲۰۰,۰۰۰» — grouped thousands in Persian digits, no unit.
 *
 * Grouped with en-US and then transliterated rather than formatted with a
 * Persian locale directly: `toLocaleString('fa-IR')` groups with the Arabic
 * thousands separator (٬) on some engines and a comma on others, and an Android
 * WebView disagreeing with a desktop browser about what a number looks like is
 * not a difference worth having. The digits are ours to convert either way.
 */
export function formatMoney(amount: number): string {
  const rounded = Math.round(Math.abs(amount));
  const grouped = toPersianDigits(rounded.toLocaleString('en-US'));
  // U+2212 MINUS SIGN, not a hyphen: it sits at digit height and doesn't get
  // mistaken for a dash between two numbers.
  return amount < 0 ? `−${grouped}` : grouped;
}

/** «۱,۲۰۰,۰۰۰ تومان» — the same figure wearing its unit. */
export function formatToman(amount: number): string {
  return `${formatMoney(amount)} تومان`;
}

/**
 * What the amount field shows while it is being typed: digits only, grouped.
 *
 * Runs on every keystroke, so it accepts whatever a Persian or Arabic keyboard
 * emits (fromPersianDigits) and throws away everything that isn't a digit —
 * including the separators it added itself on the previous keystroke.
 */
export function formatAmountInput(raw: string): string {
  const amount = parseAmountInput(raw);
  if (amount === 0 && !/[0-9]/.test(fromPersianDigits(raw))) return '';
  return formatMoney(amount);
}

/** The number behind that text. Returns 0 for anything with no digits in it. */
export function parseAmountInput(raw: string): number {
  const digits = fromPersianDigits(raw).replace(/[^0-9]/g, '');
  if (!digits) return 0;
  // Clamped rather than allowed to reach Number.MAX_SAFE_INTEGER: past this the
  // sums stop being money and start being a hazard to every total on screen.
  return Math.min(Number(digits), MAX_AMOUNT);
}

/** «٪۳۴» — a share, rounded to whole percent. */
export function formatPercent(share: number): string {
  return `٪${toPersianDigits(Math.round(share * 100))}`;
}
