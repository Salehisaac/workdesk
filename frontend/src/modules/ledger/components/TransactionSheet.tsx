import { Dialog, Popup, Toast } from 'antd-mobile';
import { CloseOutline, DeleteOutline } from 'antd-mobile-icons';
import type { CSSProperties, ReactNode } from 'react';
import { formatLongDate, formatTime } from '../../../shared/date/jalali';
import { tagColor } from '../../project/components/job/tagColor';
import { useDeleteTransaction } from '../api';
import { formatToman } from '../money';
import { ACCOUNT_GROUP_LABEL, TRANSACTION_TYPE_LABEL } from '../types';
import type { LedgerTag, LedgerTransaction } from '../types';
import styles from './TransactionSheet.module.css';

interface TransactionSheetProps {
  transaction: LedgerTransaction | null;
  tags: LedgerTag[];
  ledgerId: string;
  onClose: () => void;
}

/**
 * Everything about one line, and the one thing that can be done to it.
 *
 * The card shows what you scan for; this shows what you filed. It is also where
 * deleting lives, because deleting a transaction is the module's only edit —
 * there is no «ویرایش» screen, and correcting a mistyped amount means removing
 * the line and writing it again, which is what the paper version of this book
 * requires too.
 */
export function TransactionSheet({ transaction, tags, ledgerId, onClose }: TransactionSheetProps) {
  const deleteTransaction = useDeleteTransaction(ledgerId);

  const income = transaction?.type === 'income';
  const rowTags = transaction ? tags.filter((tag) => transaction.tagIds.includes(tag.id)) : [];
  const occurredAt = transaction ? new Date(transaction.occurredAt) : null;

  async function handleDelete() {
    if (!transaction || deleteTransaction.isPending) return;

    // Asked, not undone afterwards: a toast with an «بازگردانی» button would
    // have to survive the screen being left, and every total on the ledger is
    // derived from these rows — a balance that is briefly wrong is worse than
    // one confirmation tap.
    const confirmed = await Dialog.confirm({
      title: 'این تراکنش حذف شود؟',
      content: 'مبلغ آن از مجموع‌ها و گزارش‌های این دفتر کم می‌شود. این کار برگشت‌پذیر نیست.',
      confirmText: 'حذف',
      cancelText: 'انصراف',
    });
    if (!confirmed) return;

    try {
      await deleteTransaction.mutateAsync(transaction.id);
      Toast.show({ content: 'تراکنش حذف شد' });
      onClose();
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'حذف تراکنش با خطا مواجه شد' });
    }
  }

  return (
    <Popup
      visible={!!transaction}
      position="bottom"
      closeOnSwipe
      closeOnMaskClick
      onClose={onClose}
      onMaskClick={onClose}
      bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
    >
      <div className={styles.sheet}>
        <span className={styles.handle} aria-hidden="true" />

        {transaction && occurredAt && (
          <>
            <div className={styles.head}>
              <span className={styles.headTitle}>جزئیات تراکنش</span>
              <button type="button" className={styles.headClose} onClick={onClose} aria-label="بستن">
                <CloseOutline />
              </button>
            </div>

            <div className={`${styles.hero} ${income ? styles.heroIncome : styles.heroExpense}`}>
              <span className={styles.heroKind}>{TRANSACTION_TYPE_LABEL[transaction.type]}</span>
              <span className={styles.heroAmount}>{formatToman(transaction.amount)}</span>
            </div>

            <div className={styles.rows}>
              <Row label="گروه حساب">{ACCOUNT_GROUP_LABEL[transaction.accountGroup]}</Row>
              <Row label="تاریخ">
                {formatLongDate(occurredAt)}
                <span className={styles.rowMeta}>{formatTime(occurredAt)}</span>
              </Row>
              {transaction.sourceName && <Row label="منبع مالی">{transaction.sourceName}</Row>}
              {transaction.assigneeName && <Row label="مسئول">{transaction.assigneeName}</Row>}
              {rowTags.length > 0 && (
                <Row label="برچسب‌ها">
                  <span className={styles.tags}>
                    {rowTags.map((tag) => (
                      <span
                        key={tag.id}
                        className={styles.tag}
                        style={{ background: tag.color ?? tagColor(tag.name) } as CSSProperties}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </span>
                </Row>
              )}
              {transaction.description && <Row label="شرح">{transaction.description}</Row>}
            </div>

            <button type="button" className={styles.delete} onClick={handleDelete} disabled={deleteTransaction.isPending}>
              <DeleteOutline />
              حذف تراکنش
            </button>
          </>
        )}
      </div>
    </Popup>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{children}</span>
    </div>
  );
}
