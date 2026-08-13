/**
 * Ledger module — «دفتر مالی»: درآمدها و هزینه‌ها.
 *
 * Same camelCase JSON and ISO-8601 conventions as every other module. The one
 * thing worth knowing before reading the rest: a transaction's **sign lives in
 * `type`, never in `amount`**. An amount is always a positive number of Tomans,
 * and «هزینه» is a direction, not a negative quantity — so nothing here ever has
 * to guess whether a figure has already been negated.
 */
import type { PickedItem } from '../../bridge/types';

export type TransactionType = 'income' | 'expense';

export const TRANSACTION_TYPE_LABEL: Record<TransactionType, string> = {
  income: 'درآمد',
  expense: 'هزینه',
};

/** Income first: it is the direction the empty state invites, and the one the «مجموع» chart puts on the right. */
export const TRANSACTION_TYPES: TransactionType[] = ['income', 'expense'];

/**
 * «گروه حساب» — the fixed five, in the order the form offers them.
 *
 * Fixed rather than a per-ledger pool (which is what tags and «منابع مالی» are)
 * because these are accounting categories: they mean the same thing in every
 * book, so a report grouped by them can be compared between two of them. Mirrors
 * models.LedgerAccountGroups on the backend.
 */
export type AccountGroup = 'other' | 'salary' | 'bonus' | 'sales' | 'transfer';

export const ACCOUNT_GROUP_LABEL: Record<AccountGroup, string> = {
  other: 'سایر',
  salary: 'حقوق',
  bonus: 'پاداش',
  sales: 'فروش',
  transfer: 'انتقال',
};

export const ACCOUNT_GROUPS: AccountGroup[] = ['other', 'salary', 'bonus', 'sales', 'transfer'];

/** A member of a ledger — a picked item plus what they may do with the book. */
export interface LedgerMember extends PickedItem {
  role: 'owner' | 'member';
}

/** The ledger-scoped tag pool, the exact counterpart of a project's `JobTag`. */
export interface LedgerTag {
  id: string;
  ledgerId: string;
  name: string;
  /** Null means the frontend derives a stable colour from the name. */
  color: string | null;
}

/**
 * «منبع مالی» — where the money moved through: a cash box, one card, one
 * account. A pool rather than an enum because a source is a thing this
 * particular business owns and only its own bookkeeper can name.
 */
export interface LedgerSource {
  id: string;
  ledgerId: string;
  name: string;
}

export interface Ledger {
  id: string;
  name: string;
  memberCount: number;
  /** Tomans, summed server-side so the list can show a balance it never loaded rows for. */
  totalIncome: number;
  totalExpense: number;
  /** income − expense. Negative in any book that has spent more than it took in. */
  balance: number;
  transactionCount: number;
  createdAt: string;
}

export interface LedgerTransaction {
  id: string;
  ledgerId: string;
  type: TransactionType;
  /** Tomans, whole units, always positive — see the note at the top of this file. */
  amount: number;
  accountGroup: AccountGroup;
  description: string | null;
  sourceId: string | null;
  /** Denormalized, like a session's projectName — a row is read far from its pool. */
  sourceName: string | null;
  /** Resolved against the ledger's own tag pool, which travels in the same response. */
  tagIds: string[];
  /** The «مسئول». Not necessarily a member of the ledger — the picker reaches the whole address book. */
  assigneeId: string | null;
  assigneeName: string | null;
  /** ISO 8601 — the day the money moved, which is what every report groups by. */
  occurredAt: string;
  /** When the line was written down, which is often a different day. */
  createdAt: string;
}

/**
 * The whole book in one response.
 *
 * `transactions` comes down complete rather than paged by period because every
 * screen in the module is a *cut* of the same rows — the three tabs, and each of
 * the five report periods — so re-fetching per cut would put a round trip behind
 * tapping «هفته قبل».
 */
export interface LedgerDetail extends Ledger {
  members: LedgerMember[];
  tags: LedgerTag[];
  sources: LedgerSource[];
  transactions: LedgerTransaction[];
}

export interface CreateLedgerInput {
  name: string;
  /** Everyone who may write in it. The creator is added as owner server-side. */
  members: PickedItem[];
}

export interface CreateTransactionInput {
  type: TransactionType;
  /** Positive Tomans. Zero is rejected server-side — a line worth nothing moves no money. */
  amount: number;
  accountGroup: AccountGroup;
  description?: string;
  /** One of this ledger's own sources, or omitted. */
  sourceId?: string;
  /** Tags of this ledger, or omitted. */
  tagIds?: string[];
  /** The whole picked item, stored verbatim server-side. */
  assignee?: PickedItem;
  /** ISO 8601 carrying the device's offset — see toLocalIso. */
  occurredAt: string;
}

export interface CreateLedgerTagInput {
  name: string;
  color?: string;
}

export interface CreateLedgerSourceInput {
  name: string;
}
