import { ActionSheet, Dialog, DotLoading, Input, Toast } from 'antd-mobile';
import {
  CalculatorOutline,
  ExclamationCircleOutline,
  HistogramOutline,
  RightOutline,
  SetOutline,
} from 'antd-mobile-icons';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMe } from '../../../shared/api/me';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { HomeButton } from '../../../shared/ui/HomeButton';
import { AddMembersSheet } from '../../../shared/ui/people/AddMembersSheet';
import { useAddLedgerMembers, useDeleteLedger, useLedger, useUpdateLedger } from '../api';
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
  const me = useMe();
  const updateLedger = useUpdateLedger(ledgerId ?? '');
  const deleteLedger = useDeleteLedger(ledgerId ?? '');
  const addMembers = useAddLedgerMembers(ledgerId ?? '');

  const [tab, setTab] = useState<OverviewTab>('summary');
  const [reportOpen, setReportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [membersOpen, setMembersOpen] = useState(false);

  const newTransaction = (type: 'income' | 'expense') =>
    navigate(`/ledgers/${ledgerId}/transactions/new?type=${type}`);

  // The book belongs to whoever opened it: renaming and deleting are theirs.
  // Everyone else writes lines in it, which is the half deliberately left open.
  const isOwner = !!ledger.data && !!me.data && ledger.data.ownerRefId === me.data.id;

  async function handleRename() {
    const name = renameValue.trim();
    setRenameOpen(false);
    if (!ledger.data || !name || name === ledger.data.name) return;

    try {
      await updateLedger.mutateAsync({ name });
      Toast.show({ content: 'نام دفتر تغییر کرد' });
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'تغییر نام با خطا مواجه شد' });
    }
  }

  async function handleDelete() {
    if (!ledger.data || deleteLedger.isPending) return;

    const confirmed = await Dialog.confirm({
      title: `«${ledger.data.name}» حذف شود؟`,
      content:
        'همه‌ی درآمدها و هزینه‌های ثبت‌شده در این دفتر — از هر کسی که ثبت کرده باشد — با آن پاک می‌شوند، همراه با برچسب‌ها و منابع مالی‌اش. این کار برگشت‌پذیر نیست.',
      confirmText: 'حذف دفتر',
      cancelText: 'انصراف',
    });
    if (!confirmed) return;

    try {
      await deleteLedger.mutateAsync();
      Toast.show({ content: 'دفتر حذف شد' });
      navigate('/ledgers', { replace: true });
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'حذف دفتر با خطا مواجه شد' });
    }
  }

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
        {/* Renaming and deleting the book, behind one button and only for whoever
            keeps it — two more icons in a bar that already carries back, home and
            «گزارش» would crowd out the name they're about. */}
        {isOwner && (
          <button
            type="button"
            className={styles.reportButton}
            onClick={() => setMenuOpen(true)}
            aria-label="تنظیمات دفتر"
          >
            <SetOutline />
          </button>
        )}
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
          ledgerOwnerRefId={ledger.data.ownerRefId}
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

      <ActionSheet
        visible={menuOpen}
        actions={[
          { key: 'members', text: 'افزودن عضو' },
          { key: 'rename', text: 'تغییر نام دفتر' },
          { key: 'delete', text: 'حذف دفتر', danger: true },
        ]}
        cancelText="انصراف"
        onClose={() => setMenuOpen(false)}
        onMaskClick={() => setMenuOpen(false)}
        onAction={(action) => {
          setMenuOpen(false);
          if (action.key === 'delete') {
            void handleDelete();
            return;
          }
          if (action.key === 'members') {
            setMembersOpen(true);
            return;
          }
          setRenameValue(ledger.data?.name ?? '');
          setRenameOpen(true);
        }}
      />

      <AddMembersSheet
        visible={membersOpen}
        title="افزودن عضو به دفتر"
        hint="هرکسی که اضافه کنید می‌تواند در این دفتر درآمد و هزینه ثبت کند. لینک دفتر با پیام ربات برایشان فرستاده می‌شود."
        submitting={addMembers.isPending}
        onClose={() => setMembersOpen(false)}
        onSubmit={async (members) => {
          await addMembers.mutateAsync(members);
          Toast.show({ content: 'به دفتر اضافه شدند' });
        }}
      />

      {/* The declarative Dialog, not Dialog.confirm: the field is controlled, and
          an imperative dialog renders its content once — the typing would never
          reach it. */}
      <Dialog
        visible={renameOpen}
        title="تغییر نام دفتر"
        content={
          <Input
            value={renameValue}
            onChange={setRenameValue}
            placeholder="نام دفتر"
            maxLength={64}
            aria-label="نام دفتر"
          />
        }
        closeOnAction
        onClose={() => setRenameOpen(false)}
        actions={[
          [
            { key: 'cancel', text: 'انصراف' },
            { key: 'save', text: 'ذخیره', bold: true },
          ],
        ]}
        onAction={(action) => {
          if (action.key === 'save') void handleRename();
          else setRenameOpen(false);
        }}
      />
    </div>
  );
}
