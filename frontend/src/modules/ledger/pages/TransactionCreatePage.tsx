import { DotLoading, Input, Toast } from 'antd-mobile';
import { CheckOutline, DownOutline, ExclamationCircleOutline, RightOutline } from 'antd-mobile-icons';
import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { PickedItem } from '../../../bridge/types';
import { formatLongDate, formatTime, toLocalIso } from '../../../shared/date/jalali';
import { DateTimeSheet } from '../../../shared/ui/datetime/DateTimeSheet';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { tagColor } from '../../project/components/job/tagColor';
import { useCreateLedgerSource, useCreateLedgerTag, useCreateTransaction, useLedger } from '../api';
import { AssigneeSheet, ChoiceSheet, PoolSheet } from '../components/LedgerSheets';
import { formatAmountInput, parseAmountInput } from '../money';
import {
  ACCOUNT_GROUPS,
  ACCOUNT_GROUP_LABEL,
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_LABEL,
} from '../types';
import type { AccountGroup, TransactionType } from '../types';
import styles from './TransactionCreatePage.module.css';

type OpenSheet = 'date' | 'type' | 'group' | 'source' | 'tags' | 'assignee' | null;

/**
 * «تراکنش جدید» — one line of the book.
 *
 * The type arrives already chosen, from whichever of the two buttons opened
 * this screen, and stays editable in case the wrong one was tapped. Only two
 * fields are actually required — the amount, and the day, which is seeded with
 * now — so the common case (a shopkeeper recording a sale) is two taps and a
 * number. Everything below the amount is what makes the *reports* worth
 * reading later, and is optional precisely so that recording money is never
 * blocked on categorising it.
 */
export function TransactionCreatePage() {
  const { ledgerId } = useParams<{ ledgerId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const ledger = useLedger(ledgerId);
  const createTransaction = useCreateTransaction(ledgerId ?? '');
  const createTag = useCreateLedgerTag(ledgerId ?? '');
  const createSource = useCreateLedgerSource(ledgerId ?? '');

  const initialType: TransactionType = searchParams.get('type') === 'expense' ? 'expense' : 'income';

  const [type, setType] = useState<TransactionType>(initialType);
  // Now, seeded once: money is nearly always recorded as it moves, and making
  // everyone pick today's date by hand answers a question nobody asked. Still
  // fully editable — a receipt found in a pocket is the other half of the case.
  const [occurredAt, setOccurredAt] = useState<Date>(() => new Date());
  const [amount, setAmount] = useState('');
  const [accountGroup, setAccountGroup] = useState<AccountGroup>('other');
  const [description, setDescription] = useState('');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [assignee, setAssignee] = useState<PickedItem | null>(null);
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const [submitting, setSubmitting] = useState(false);

  const tags = ledger.data?.tags ?? [];
  const sources = ledger.data?.sources ?? [];
  const selectedTags = tags.filter((tag) => tagIds.includes(tag.id));
  const selectedSource = sources.find((source) => source.id === sourceId) ?? null;

  async function handleSubmit() {
    if (submitting) return;

    const value = parseAmountInput(amount);
    if (value <= 0) {
      Toast.show({ content: 'مبلغ تراکنش را وارد کنید' });
      return;
    }

    setSubmitting(true);
    try {
      await createTransaction.mutateAsync({
        type,
        amount: value,
        accountGroup,
        description: description.trim() || undefined,
        sourceId: sourceId ?? undefined,
        tagIds: tagIds.length > 0 ? tagIds : undefined,
        assignee: assignee ?? undefined,
        // Offset-carrying, not toISOString(): the day a transaction belongs to
        // is the day the person recording it was living in, and every period
        // report is cut on that boundary.
        occurredAt: toLocalIso(occurredAt),
      });
      Toast.show({ content: type === 'income' ? 'درآمد ثبت شد' : 'هزینه ثبت شد' });
      navigate(`/ledgers/${ledgerId}`, { replace: true });
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'ثبت تراکنش با خطا مواجه شد' });
    } finally {
      setSubmitting(false);
    }
  }

  if (ledger.isError) {
    return (
      <div className={styles.page}>
        <Header onBack={() => navigate(-1)} />
        <div className={styles.fill}>
          <EmptyState
            icon={<ExclamationCircleOutline />}
            title="ارتباط برقرار نشد"
            description="بارگذاری این دفتر با خطا مواجه شد. دوباره تلاش کنید."
          />
        </div>
      </div>
    );
  }

  if (ledger.isLoading || !ledger.data) {
    return (
      <div className={styles.page}>
        <Header onBack={() => navigate(-1)} />
        <div className={styles.fill}>
          <EmptyState icon={<DotLoading />} title="در حال بارگذاری…" />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Header onBack={() => navigate(-1)} onSubmit={handleSubmit} submitting={submitting} />

      <div className={styles.form}>
        <Field label="تاریخ">
          <button type="button" className={`${styles.box} ${styles.dateBox}`} onClick={() => setSheet('date')}>
            <span className={styles.dateText}>
              {formatLongDate(occurredAt)} ساعت {formatTime(occurredAt)}
            </span>
          </button>
        </Field>

        <Field label="نوع تراکنش">
          <button type="button" className={`${styles.box} ${styles.select}`} onClick={() => setSheet('type')}>
            <span className={`${styles.selectValue} ${type === 'income' ? styles.income : styles.expense}`}>
              {TRANSACTION_TYPE_LABEL[type]}
            </span>
            <DownOutline className={styles.chevron} />
          </button>
        </Field>

        {/* The one field that must be filled, so it gets the biggest type on the
            screen and a keypad that opens on digits. */}
        <Field label="مبلغ (تومان)">
          <div className={styles.box}>
            <Input
              className={styles.amountInput}
              value={amount}
              onChange={(value) => setAmount(formatAmountInput(value))}
              placeholder="۰"
              // Persian keyboards emit ۰-۹ and the formatter reads those, but
              // `numeric` still gets the digit pad up on every device.
              inputMode="numeric"
            />
          </div>
        </Field>

        <Field label="گروه حساب">
          <button type="button" className={`${styles.box} ${styles.select}`} onClick={() => setSheet('group')}>
            <span className={styles.selectValue}>{ACCOUNT_GROUP_LABEL[accountGroup]}</span>
            <DownOutline className={styles.chevron} />
          </button>
        </Field>

        <Field>
          <div className={styles.box}>
            <Input className={styles.textInput} placeholder="شرح" value={description} onChange={setDescription} maxLength={280} />
          </div>
        </Field>

        <Field label="منبع مالی">
          <button type="button" className={`${styles.box} ${styles.select}`} onClick={() => setSheet('source')}>
            <span className={`${styles.selectValue} ${selectedSource ? '' : styles.placeholder}`}>
              {selectedSource?.name ?? 'انتخاب کنید'}
            </span>
            <DownOutline className={styles.chevron} />
          </button>
        </Field>

        <Field label="برچسب‌ها">
          <button type="button" className={`${styles.box} ${styles.chips}`} onClick={() => setSheet('tags')}>
            {selectedTags.length === 0 ? (
              <span className={styles.ghostChip}>یک برچسب انتخاب کنید</span>
            ) : (
              selectedTags.map((tag) => (
                <span key={tag.id} className={styles.chip} style={{ background: tag.color ?? tagColor(tag.name) } as CSSProperties}>
                  {tag.name}
                </span>
              ))
            )}
          </button>
        </Field>

        <Field label="مسئول">
          <button type="button" className={`${styles.box} ${styles.select}`} onClick={() => setSheet('assignee')}>
            <span className={`${styles.selectValue} ${assignee ? '' : styles.placeholder}`}>
              {assignee?.displayName ?? 'فردی را انتخاب کنید'}
            </span>
          </button>
        </Field>
      </div>

      <DateTimeSheet
        visible={sheet === 'date'}
        value={occurredAt}
        title="تاریخ تراکنش"
        onClose={() => setSheet(null)}
        onConfirm={(value) => {
          setOccurredAt(value);
          setSheet(null);
        }}
      />

      <ChoiceSheet
        visible={sheet === 'type'}
        title="نوع تراکنش"
        options={TRANSACTION_TYPES.map((option) => ({ key: option, label: TRANSACTION_TYPE_LABEL[option] }))}
        value={type}
        onClose={() => setSheet(null)}
        onSelect={(value) => {
          setType(value);
          setSheet(null);
        }}
      />

      <ChoiceSheet
        visible={sheet === 'group'}
        title="گروه حساب"
        options={ACCOUNT_GROUPS.map((option) => ({ key: option, label: ACCOUNT_GROUP_LABEL[option] }))}
        value={accountGroup}
        onClose={() => setSheet(null)}
        onSelect={(value) => {
          setAccountGroup(value);
          setSheet(null);
        }}
      />

      <PoolSheet
        visible={sheet === 'source'}
        title="منبع مالی"
        items={sources}
        selectedIds={sourceId ? [sourceId] : []}
        multiple={false}
        placeholder="منبع جدید (مثلاً: صندوق فروشگاه)"
        emptyText="هنوز منبعی برای این دفتر ثبت نشده است."
        onClose={() => setSheet(null)}
        onCreate={(name) => createSource.mutateAsync({ name })}
        onConfirm={(ids) => {
          setSourceId(ids[0] ?? null);
          setSheet(null);
        }}
      />

      <PoolSheet
        visible={sheet === 'tags'}
        title="برچسب‌ها"
        items={tags}
        selectedIds={tagIds}
        multiple
        colored
        placeholder="برچسب جدید بنویس"
        emptyText="هنوز برچسبی در این دفتر ساخته نشده است."
        onClose={() => setSheet(null)}
        onCreate={(name) => createTag.mutateAsync({ name, color: tagColor(name) })}
        onConfirm={(ids) => {
          setTagIds(ids);
          setSheet(null);
        }}
      />

      <AssigneeSheet
        visible={sheet === 'assignee'}
        members={ledger.data.members}
        value={assignee}
        onClose={() => setSheet(null)}
        onSelect={(value) => {
          setAssignee(value);
          setSheet(null);
        }}
      />
    </div>
  );
}

function Header({ onBack, onSubmit, submitting }: { onBack: () => void; onSubmit?: () => void; submitting?: boolean }) {
  return (
    <header className={styles.header}>
      <button type="button" className={styles.back} onClick={onBack} aria-label="بازگشت">
        <RightOutline />
      </button>
      <h1 className={styles.headerTitle}>تراکنش جدید</h1>
      {onSubmit ? (
        <button type="button" className={styles.submit} onClick={onSubmit} disabled={submitting} aria-label="ثبت تراکنش">
          <CheckOutline />
        </button>
      ) : (
        <span className={styles.headerSpacer} aria-hidden="true" />
      )}
    </header>
  );
}

function Field({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      {label && <span className={styles.fieldLabel}>{label}</span>}
      {children}
    </div>
  );
}
