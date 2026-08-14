import { DotLoading } from 'antd-mobile';
import {
  CalculatorOutline,
  ExclamationCircleOutline,
  HistogramOutline,
  RightOutline,
} from 'antd-mobile-icons';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { HomeButton } from '../../../shared/ui/HomeButton';
import { useLedger } from '../api';
import { LedgerOverview } from '../components/LedgerOverview';
import type { OverviewTab } from '../components/LedgerOverview';
import { ReportPeriodDialog } from '../components/ReportPeriodDialog';
import styles from './LedgerBookPage.module.css';

/**
 * The book itself — «دفتر مالی».
 *
 * Three tabs over one set of rows (LedgerOverview does that part), and two
 * buttons that are the module's whole point: recording money is what people
 * open this for, so both directions are one tap from the bottom of the screen
 * at all times rather than behind a single «+» that then asks which kind.
 *
 * The two are not the same button in two colours: which direction you are about
 * to record is chosen *before* the form opens, which is why the type field
 * inside it arrives already answered.
 */
export function LedgerBookPage() {
  const { ledgerId } = useParams<{ ledgerId: string }>();
  const navigate = useNavigate();
  const ledger = useLedger(ledgerId);

  const [tab, setTab] = useState<OverviewTab>('summary');
  const [reportOpen, setReportOpen] = useState(false);

  const newTransaction = (type: 'income' | 'expense') =>
    navigate(`/ledgers/${ledgerId}/transactions/new?type=${type}`);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate('/ledgers')} aria-label="بازگشت">
          <RightOutline />
        </button>
        {/* This screen is an invite's landing page (startapp=ledger-<id>), so
            whoever is reading it may never have been anywhere else in the app —
            back offers them a list they were never on. */}
        <HomeButton />
        <h1 className={styles.headerTitle}>{ledger.data?.name ?? 'دفتر مالی'}</h1>
        {/* Balances the home button on the other side, so the book's name stays
            in the middle of the bar rather than drifting off it. */}
        <span className={styles.headerSpacer} aria-hidden="true" />
        <button
          type="button"
          className={styles.reportButton}
          onClick={() => setReportOpen(true)}
          disabled={!ledger.data}
          aria-label="گزارش"
        >
          <HistogramOutline />
        </button>
      </header>

      {ledger.isLoading && (
        <div className={styles.fill}>
          <EmptyState icon={<DotLoading />} title="در حال بارگذاری…" />
        </div>
      )}

      {!ledger.isLoading && ledger.isError && (
        <div className={styles.fill}>
          <EmptyState
            icon={<ExclamationCircleOutline />}
            title="ارتباط برقرار نشد"
            description="بارگذاری این دفتر با خطا مواجه شد. دوباره تلاش کنید."
          />
        </div>
      )}

      {/* A brand new book gets the invitation rather than three tabs over
          nothing: with no rows at all, «درآمدها» and «هزینه‌ها» are two empty
          charts asking to be compared. */}
      {ledger.data && ledger.data.transactions.length === 0 && (
        <div className={styles.fill}>
          <EmptyState
            icon={<CalculatorOutline />}
            title="برای شروع یک درآمد جدید ثبت کنید"
            description="هر درآمد و هزینه‌ای که اینجا ثبت شود، در مجموع‌ها و گزارش‌های همین دفتر دیده می‌شود."
          />
        </div>
      )}

      {ledger.data && ledger.data.transactions.length > 0 && (
        <LedgerOverview
          transactions={ledger.data.transactions}
          tags={ledger.data.tags}
          ledgerId={ledger.data.id}
          tab={tab}
          onTabChange={setTab}
          emptyTitle="هنوز تراکنشی ثبت نشده"
        />
      )}

      <div className={styles.footer}>
        <button type="button" className={`${styles.action} ${styles.expense}`} onClick={() => newTransaction('expense')}>
          هزینه جدید
        </button>
        <button type="button" className={`${styles.action} ${styles.income}`} onClick={() => newTransaction('income')}>
          درآمد جدید
        </button>
      </div>

      <ReportPeriodDialog
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        onConfirm={(period) => {
          setReportOpen(false);
          navigate(`/ledgers/${ledgerId}/report?period=${period}`);
        }}
      />
    </div>
  );
}
