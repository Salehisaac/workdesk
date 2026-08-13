import { Button, DotLoading } from 'antd-mobile';
import { AddOutline, BillOutline, ExclamationCircleOutline, RightOutline, TeamOutline } from 'antd-mobile-icons';
import { useNavigate } from 'react-router-dom';
import { toPersianDigits } from '../../../shared/date/jalali';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { useLedgers } from '../api';
import { formatMoney, formatToman } from '../money';
import styles from './LedgerListPage.module.css';

/**
 * «دفترهای مالی» — the module's front door.
 *
 * Each row carries its book's balance, which is why GET /ledgers totals
 * server-side: a list of books you have to open one by one to find out which is
 * in the red is a list of names, not a dashboard. The balance leads and the two
 * sides are underneath it, in that order, because "how much is left" is the
 * question and "how it got there" is the follow-up.
 */
export function LedgerListPage() {
  const navigate = useNavigate();
  const ledgers = useLedgers();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate('/')} aria-label="بازگشت">
          <RightOutline />
        </button>
        <h1 className={styles.headerTitle}>دفتر مالی</h1>
        <span className={styles.headerSpacer} aria-hidden="true" />
      </header>

      <div className={styles.body}>
        {ledgers.isLoading && <EmptyState icon={<DotLoading />} title="در حال بارگذاری…" />}

        {!ledgers.isLoading && ledgers.isError && (
          <EmptyState
            icon={<ExclamationCircleOutline />}
            title="ارتباط برقرار نشد"
            description="بارگذاری دفترها با خطا مواجه شد. دوباره تلاش کنید."
          />
        )}

        {!ledgers.isLoading && !ledgers.isError && (ledgers.data?.length ?? 0) === 0 && (
          <EmptyState
            icon={<BillOutline />}
            title="هنوز دفتری ساخته نشده"
            description="یک دفتر بسازید تا درآمدها و هزینه‌ها را کنار هم ثبت کنید و مانده‌ی آن را دنبال کنید."
          />
        )}

        {!ledgers.isLoading && !ledgers.isError && (ledgers.data?.length ?? 0) > 0 && (
          <div className={styles.list}>
            {ledgers.data?.map((ledger) => (
              <button
                key={ledger.id}
                type="button"
                className={styles.card}
                onClick={() => navigate(`/ledgers/${ledger.id}`)}
              >
                <span className={styles.cardHead}>
                  <span className={styles.cardName}>{ledger.name}</span>
                  <span className={styles.balance} data-negative={ledger.balance < 0 || undefined}>
                    {formatToman(ledger.balance)}
                  </span>
                </span>

                <span className={styles.cardMeta}>
                  <span className={`${styles.side} ${styles.income}`}>
                    درآمد {formatMoney(ledger.totalIncome)}
                  </span>
                  <span className={`${styles.side} ${styles.expense}`}>
                    هزینه {formatMoney(ledger.totalExpense)}
                  </span>
                  <span className={styles.metaItem}>
                    <TeamOutline aria-hidden="true" />
                    {toPersianDigits(ledger.memberCount)} نفر
                  </span>
                  <span className={styles.metaItem}>{toPersianDigits(ledger.transactionCount)} تراکنش</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <Button block color="primary" size="large" onClick={() => navigate('/ledgers/new')}>
          <AddOutline /> دفتر جدید
        </Button>
      </div>
    </div>
  );
}
