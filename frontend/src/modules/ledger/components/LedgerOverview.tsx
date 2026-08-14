import { PieOutline } from 'antd-mobile-icons';
import { useMemo, useState } from 'react';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { breakdownByGroup, totalsOf } from '../report';
import type { LedgerTag, LedgerTransaction } from '../types';
import { BalanceBars, GroupDonut, transactionCount } from './Charts';
import { TransactionCard } from './TransactionCard';
import { TransactionSheet } from './TransactionSheet';
import styles from './LedgerOverview.module.css';

export type OverviewTab = 'summary' | 'incomes' | 'expenses';

export const OVERVIEW_TABS: { key: OverviewTab; label: string }[] = [
  { key: 'summary', label: 'مجموع' },
  { key: 'incomes', label: 'درآمدها' },
  { key: 'expenses', label: 'هزینه‌ها' },
];

interface LedgerOverviewProps {
  /** Already scoped by the caller — a period, a filter, or the whole book. */
  transactions: LedgerTransaction[];
  tags: LedgerTag[];
  ledgerId: string;
  /**
   * Who keeps the book. Passed through to the detail sheet, which offers
   * «حذف تراکنش» only to the person who wrote the line or to them — writing in a
   * shared book is everyone's, striking a line out is not.
   */
  ledgerOwnerRefId: string;
  tab: OverviewTab;
  onTabChange: (tab: OverviewTab) => void;
  /** What "nothing here" means in the caller's scope — a young book, or a quiet week. */
  emptyTitle: string;
  emptyDescription?: string;
}

/**
 * The book itself: three ways of reading the same rows.
 *
 * Shared by the ledger screen and the report screen, which differ only in which
 * rows they hand it — that is the whole reason «گزارش روزانه» needed no second
 * implementation of anything. A period is a filter, not a different kind of
 * page.
 *
 * Each tab's list holds only that tab's rows: «درآمدها» showing expenses
 * underneath its income chart would leave the reader checking every card's
 * colour to find out which half of the screen it belongs to. «مجموع» is where
 * both live together, which is what makes it «مجموع».
 */
export function LedgerOverview({
  transactions,
  tags,
  ledgerId,
  ledgerOwnerRefId,
  tab,
  onTabChange,
  emptyTitle,
  emptyDescription,
}: LedgerOverviewProps) {
  const [opened, setOpened] = useState<LedgerTransaction | null>(null);

  const totals = useMemo(() => totalsOf(transactions), [transactions]);
  const incomeSlices = useMemo(() => breakdownByGroup(transactions, 'income'), [transactions]);
  const expenseSlices = useMemo(() => breakdownByGroup(transactions, 'expense'), [transactions]);

  const visible = useMemo(() => {
    if (tab === 'incomes') return transactions.filter((transaction) => transaction.type === 'income');
    if (tab === 'expenses') return transactions.filter((transaction) => transaction.type === 'expense');
    return transactions;
  }, [transactions, tab]);

  return (
    <div className={styles.overview}>
      <div className={styles.tabs} role="tablist">
        {OVERVIEW_TABS.map((option) => (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={tab === option.key}
            className={`${styles.tab} ${tab === option.key ? styles.tabActive : ''}`}
            onClick={() => onTabChange(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className={styles.body}>
        {transactions.length === 0 ? (
          <EmptyState icon={<PieOutline />} title={emptyTitle} description={emptyDescription} />
        ) : (
          <>
            {tab === 'summary' && <BalanceBars income={totals.income} expense={totals.expense} />}
            {tab === 'incomes' &&
              (incomeSlices.length === 0 ? (
                <EmptyState icon={<PieOutline />} title="در این بازه درآمدی ثبت نشده" />
              ) : (
                <GroupDonut slices={incomeSlices} total={totals.income} type="income" />
              ))}
            {tab === 'expenses' &&
              (expenseSlices.length === 0 ? (
                <EmptyState icon={<PieOutline />} title="در این بازه هزینه‌ای ثبت نشده" />
              ) : (
                <GroupDonut slices={expenseSlices} total={totals.expense} type="expense" />
              ))}

            {visible.length > 0 && (
              <div className={styles.list}>
                <div className={styles.listHead}>{transactionCount(visible.length)}</div>
                {visible.map((transaction) => (
                  <TransactionCard key={transaction.id} transaction={transaction} tags={tags} onOpen={setOpened} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <TransactionSheet
        transaction={opened}
        tags={tags}
        ledgerId={ledgerId}
        ledgerOwnerRefId={ledgerOwnerRefId}
        onClose={() => setOpened(null)}
      />
    </div>
  );
}
