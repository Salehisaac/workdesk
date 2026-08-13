import { Dialog, Input, Popup, Toast } from 'antd-mobile';
import { AddOutline, CheckOutline, CloseOutline, TeamOutline } from 'antd-mobile-icons';
import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { bridge } from '../../../bridge';
import type { PickedItem } from '../../../bridge/types';
import { monogramGradient, monogramInitial, paletteForSeed } from '../../../shared/brand/monogram';
import { tagColor } from '../../project/components/job/tagColor';
import type { LedgerMember } from '../types';
import styles from './LedgerSheets.module.css';

interface SheetFrameProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  /** Rendered in the header's start corner — a ✓ for the sheets that confirm. */
  confirm?: { label: string; onClick: () => void };
  children: React.ReactNode;
}

/**
 * The shell every sheet in this module wears: a grabber, a titled header, and a
 * scrolling body. Written once so the five of them can't drift apart in height,
 * radius or where the close button sits.
 */
export function SheetFrame({ visible, title, onClose, confirm, children }: SheetFrameProps) {
  return (
    <Popup
      visible={visible}
      position="bottom"
      closeOnSwipe
      closeOnMaskClick
      onClose={onClose}
      onMaskClick={onClose}
      bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
    >
      <div className={styles.sheet}>
        <span className={styles.handle} aria-hidden="true" />

        <div className={styles.head}>
          {confirm ? (
            <button type="button" className={styles.headConfirm} onClick={confirm.onClick} aria-label={confirm.label}>
              <CheckOutline />
            </button>
          ) : (
            <span className={styles.headSpacer} aria-hidden="true" />
          )}
          <span className={styles.headTitle}>{title}</span>
          <button type="button" className={styles.headClose} onClick={onClose} aria-label="بستن">
            <CloseOutline />
          </button>
        </div>

        <div className={styles.body}>{children}</div>
      </div>
    </Popup>
  );
}

interface ChoiceSheetProps<T extends string> {
  visible: boolean;
  title: string;
  options: { key: T; label: string }[];
  value: T;
  onClose: () => void;
  onSelect: (value: T) => void;
}

/**
 * One of a fixed few — «نوع تراکنش» and «گروه حساب».
 *
 * Selecting closes it: with a handful of mutually exclusive options there is
 * nothing left to decide after the tap, and a confirm button would only be a
 * second one.
 */
export function ChoiceSheet<T extends string>({ visible, title, options, value, onClose, onSelect }: ChoiceSheetProps<T>) {
  return (
    <SheetFrame visible={visible} title={title} onClose={onClose}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          className={`${styles.row} ${option.key === value ? styles.rowActive : ''}`}
          onClick={() => onSelect(option.key)}
        >
          <span className={styles.rowLabel}>{option.label}</span>
          {option.key === value && <CheckOutline className={styles.rowCheck} />}
        </button>
      ))}
    </SheetFrame>
  );
}

export interface PoolItem {
  id: string;
  name: string;
  color?: string | null;
}

interface PoolSheetProps {
  visible: boolean;
  title: string;
  items: PoolItem[];
  selectedIds: string[];
  /** Tags take several; a «منبع مالی» is one place the money went. */
  multiple: boolean;
  /** What the new-item field says before anything is typed. */
  placeholder: string;
  /** Nothing here yet — said in the pool's own words. */
  emptyText: string;
  /** Chips, for tags; plain rows for sources. */
  colored?: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<PoolItem | null>;
  onConfirm: (ids: string[]) => void;
}

/**
 * A ledger-scoped pool — its «برچسب‌ها» or its «منابع مالی».
 *
 * Both are lists this book's own people write as they go, so the field that
 * makes a new one sits at the top rather than behind a «+» somewhere else: the
 * moment you discover you need «تنخواه» is the moment you are filing something
 * against it. A newly created item comes back selected, since asking for it and
 * wanting it are the same act.
 */
export function PoolSheet({
  visible,
  title,
  items,
  selectedIds,
  multiple,
  placeholder,
  emptyText,
  colored,
  onClose,
  onCreate,
  onConfirm,
}: PoolSheetProps) {
  const [draft, setDraft] = useState<string[]>(selectedIds);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (visible) setDraft(selectedIds);
  }, [visible, selectedIds]);

  function toggle(id: string) {
    if (!multiple) {
      // Tapping the chosen one again clears it — a source is optional, and
      // there would otherwise be no way to take one back off.
      onConfirm(draft.includes(id) ? [] : [id]);
      return;
    }
    setDraft((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || creating) return;

    setCreating(true);
    try {
      const created = await onCreate(trimmed);
      if (!created) return;
      setName('');
      if (multiple) setDraft((prev) => [...prev, created.id]);
      else onConfirm([created.id]);
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'ثبت با خطا مواجه شد' });
    } finally {
      setCreating(false);
    }
  }

  return (
    <SheetFrame
      visible={visible}
      title={title}
      onClose={onClose}
      confirm={multiple ? { label: `تأیید ${title}`, onClick: () => onConfirm(draft) } : undefined}
    >
      <div className={styles.createRow}>
        <Input className={styles.createInput} placeholder={placeholder} value={name} onChange={setName} onEnterPress={handleCreate} />
        <button
          type="button"
          className={styles.createAdd}
          onClick={handleCreate}
          disabled={!name.trim() || creating}
          aria-label={placeholder}
        >
          <AddOutline />
        </button>
      </div>

      {items.length === 0 && <p className={styles.empty}>{emptyText}</p>}

      {items.map((item) => {
        const checked = draft.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            className={`${styles.row} ${checked ? styles.rowActive : ''}`}
            onClick={() => toggle(item.id)}
          >
            {colored ? (
              <span className={styles.chip} style={{ background: item.color ?? tagColor(item.name) } as CSSProperties}>
                {item.name}
              </span>
            ) : (
              <span className={styles.rowLabel}>{item.name}</span>
            )}
            {checked && <CheckOutline className={styles.rowCheck} />}
          </button>
        );
      })}
    </SheetFrame>
  );
}

interface AssigneeSheetProps {
  visible: boolean;
  members: LedgerMember[];
  value: PickedItem | null;
  onClose: () => void;
  onSelect: (assignee: PickedItem | null) => void;
}

/**
 * «مسئول» — who the money is about.
 *
 * The book's own people come first, because they are who a transaction is
 * almost always about and picking one should cost a single tap. The client's
 * own contact picker is one row below that, for the supplier or the courier who
 * will never be a member of anything: the responsible party on a receipt is a
 * label, not an access grant, so it is deliberately not restricted to members —
 * the backend stores whoever is chosen verbatim.
 */
export function AssigneeSheet({ visible, members, value, onClose, onSelect }: AssigneeSheetProps) {
  const [picking, setPicking] = useState(false);

  async function handlePickFromContacts() {
    if (picking) return;
    setPicking(true);
    try {
      const picked = await bridge.pick({
        sources: ['users', 'contacts'],
        multiple: false,
        search: true,
        title: 'فردی را انتخاب کنید',
      });
      if (picked.length > 0) onSelect(picked[0]);
    } catch (error) {
      // Dialog rather than Toast, same as PeoplePicker: on a real device this
      // is the only place the failure can be read.
      Dialog.alert({
        title: 'انتخاب مخاطب با خطا مواجه شد',
        content: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setPicking(false);
    }
  }

  return (
    <SheetFrame visible={visible} title="فردی را انتخاب کنید" onClose={onClose}>
      {members.map((member) => {
        const checked = value?.id === member.id;
        return (
          <button
            key={`${member.source}-${member.id}`}
            type="button"
            className={`${styles.row} ${checked ? styles.rowActive : ''}`}
            onClick={() => onSelect(member)}
          >
            <span
              className={styles.avatar}
              style={{ background: monogramGradient(paletteForSeed(member.id)) } as CSSProperties}
              aria-hidden="true"
            >
              {monogramInitial(member.displayName) || '؟'}
            </span>
            <span className={styles.rowLabel}>{member.displayName}</span>
            {member.role === 'owner' && <span className={styles.rowMeta}>سازنده</span>}
            {checked && <CheckOutline className={styles.rowCheck} />}
          </button>
        );
      })}

      <button type="button" className={styles.row} onClick={handlePickFromContacts} disabled={picking}>
        <span className={styles.avatarGhost} aria-hidden="true">
          <TeamOutline />
        </span>
        <span className={styles.rowLabel}>انتخاب از مخاطبین</span>
      </button>

      {value && (
        <button type="button" className={`${styles.row} ${styles.rowClear}`} onClick={() => onSelect(null)}>
          <span className={styles.rowLabel}>بدون مسئول</span>
        </button>
      )}
    </SheetFrame>
  );
}
