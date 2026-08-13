import { DotLoading } from 'antd-mobile';
import { ExclamationCircleOutline, FilterOutline, RightOutline } from 'antd-mobile-icons';
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { formatNumericDate, today } from '../../../shared/date/jalali';
import { DateTimeSheet } from '../../../shared/ui/datetime/DateTimeSheet';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { useLedger } from '../api';
import { LedgerOverview } from '../components/LedgerOverview';
import type { OverviewTab } from '../components/LedgerOverview';
import { TransactionFilterSheet } from '../components/TransactionFilterSheet';
import {
  EMPTY_FILTER,
  PERIOD_STEP_LABEL,
  REPORT_PERIOD_LABEL,
  applyFilter,
  formatRangeLabel,
  inRange,
  isFilterActive,
  isReportPeriod,
  rangeFor,
  stepAnchor,
} from '../report';
import type { DateRange, TransactionFilter } from '../report';
import styles from './LedgerReportPage.module.css';

/**
 * «گزارش» — the same book, one period at a time.
 *
 * Not a different screen from the ledger: it hands LedgerOverview a narrower
 * slice of exactly the same rows, which is why the charts, the cards and the
 * three tabs all behave identically here. Stepping to «هفته قبل» is a re-render
 * of data already in memory, so the arrows are instant and can be held down.
 *
 * The period lives in the URL and the *position* within it lives in state: which
 * report you asked for is worth surviving a back-and-forward (it was chosen in a
 * dialog), while which particular week you had stepped to is not worth writing a
 * history entry for on every tap of «هفته بعد».
 */
export function LedgerReportPage() {
  const { ledgerId } = useParams<{ ledgerId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ledger = useLedger(ledgerId);

  const rawPeriod = searchParams.get('period');
  const period = isReportPeriod(rawPeriod) ? rawPeriod : 'daily';

  const [anchor, setAnchor] = useState<Date>(() => today());
  // «انتخابی» starts as today→today rather than empty: a range picker whose
  // both ends are unset has nothing to show, and this way the screen is already
  // answering a question when it opens.
  const [custom, setCustom] = useState<DateRange>(() => ({ start: today(), end: today() }));
  const [tab, setTab] = useState<OverviewTab>('summary');
  const [filter, setFilter] = useState<TransactionFilter>(EMPTY_FILTER);
  const [sheet, setSheet] = useState<'filter' | 'from' | 'to' | null>(null);

  const range = useMemo(() => rangeFor(period, anchor, custom), [period, anchor, custom]);
  const transactions = ledger.data?.transactions;
  const scoped = useMemo(() => {
    if (!transactions) return [];
    return applyFilter(
      transactions.filter((transaction) => inRange(transaction, range)),
      filter,
    );
  }, [transactions, range, filter]);

  const back = () => navigate(`/ledgers/${ledgerId}`);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={back} aria-label="بازگشت">
          <RightOutline />
        </button>
        <h1 className={styles.headerTitle}>{REPORT_PERIOD_LABEL[period]}</h1>
        <button
          type="button"
          className={styles.filterButton}
          data-active={isFilterActive(filter) || undefined}
          onClick={() => setSheet('filter')}
          aria-label="فیلتر"
        >
          <FilterOutline />
        </button>
      </header>

      {period === 'custom' ? (
        <div className={styles.rangeRow}>
          <button type="button" className={styles.rangeChip} onClick={() => setSheet('from')}>
            <span className={styles.rangeLabel}>از</span>
            {formatNumericDate(custom.start)}
          </button>
          <button type="button" className={styles.rangeChip} onClick={() => setSheet('to')}>
            <span className={styles.rangeLabel}>تا</span>
            {formatNumericDate(custom.end)}
          </button>
        </div>
      ) : (
        <div className={styles.stepRow}>
          {/* «بعد» leads in the DOM, which places it on the right under
              dir="rtl" — where the app this screen is modelled on puts it. */}
          <button type="button" className={styles.step} onClick={() => setAnchor((prev) => stepAnchor(period, prev, 1))}>
            {PERIOD_STEP_LABEL[period].next}
          </button>
          <span className={styles.stepValue}>{formatRangeLabel(period, range)}</span>
          <button type="button" className={styles.step} onClick={() => setAnchor((prev) => stepAnchor(period, prev, -1))}>
            {PERIOD_STEP_LABEL[period].previous}
          </button>
        </div>
      )}

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

      {ledger.data && (
        <LedgerOverview
          transactions={scoped}
          tags={ledger.data.tags}
          ledgerId={ledger.data.id}
          tab={tab}
          onTabChange={setTab}
          // "Nothing in this period" and "nothing that matches the filter" are
          // different states, and only one of them is something the reader can
          // undo — so they are told apart rather than sharing one sentence.
          emptyTitle={isFilterActive(filter) ? 'با این فیلتر تراکنشی پیدا نشد' : 'در این بازه تراکنشی ثبت نشده'}
          emptyDescription={
            isFilterActive(filter) ? 'فیلتر را تغییر دهید یا پاک کنید.' : 'بازه‌ی دیگری را ببینید یا تراکنش تازه‌ای ثبت کنید.'
          }
        />
      )}

      <TransactionFilterSheet
        visible={sheet === 'filter'}
        value={filter}
        tags={ledger.data?.tags ?? []}
        sources={ledger.data?.sources ?? []}
        onClose={() => setSheet(null)}
        onConfirm={(next) => {
          setFilter(next);
          setSheet(null);
        }}
      />

      <DateTimeSheet
        visible={sheet === 'from'}
        value={custom.start}
        title="از تاریخ"
        onClose={() => setSheet(null)}
        onConfirm={(value) => {
          setCustom((prev) => ({ ...prev, start: value }));
          setSheet(null);
        }}
      />

      <DateTimeSheet
        visible={sheet === 'to'}
        value={custom.end}
        title="تا تاریخ"
        onClose={() => setSheet(null)}
        onConfirm={(value) => {
          setCustom((prev) => ({ ...prev, end: value }));
          setSheet(null);
        }}
      />
    </div>
  );
}
