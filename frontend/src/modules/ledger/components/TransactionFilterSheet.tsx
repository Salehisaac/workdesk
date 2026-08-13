import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { tagColor } from '../../project/components/job/tagColor';
import { EMPTY_FILTER, isFilterActive } from '../report';
import type { TransactionFilter } from '../report';
import { ACCOUNT_GROUPS, ACCOUNT_GROUP_LABEL } from '../types';
import type { AccountGroup, LedgerSource, LedgerTag } from '../types';
import { groupColor } from './Charts';
import { SheetFrame } from './LedgerSheets';
import styles from './TransactionFilterSheet.module.css';

interface TransactionFilterSheetProps {
  visible: boolean;
  value: TransactionFilter;
  tags: LedgerTag[];
  sources: LedgerSource[];
  onClose: () => void;
  onConfirm: (filter: TransactionFilter) => void;
}

/**
 * The report's lens: which rows count.
 *
 * Three dimensions, each a row of chips, each an OR within itself and an AND
 * between them — «حقوق یا فروش», *from* «صندوق», tagged «شعبه ۲». Written as
 * chips rather than checkboxes because the answer is usually one tap and the
 * whole sheet has to be readable without scrolling on a phone.
 *
 * It edits a draft and applies on «اعمال»: a filter that narrowed the screen on
 * every tap would make the sheet fight the numbers behind it, and choosing two
 * groups would flash through a one-group state that nobody asked for.
 */
export function TransactionFilterSheet({ visible, value, tags, sources, onClose, onConfirm }: TransactionFilterSheetProps) {
  const [draft, setDraft] = useState<TransactionFilter>(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  function toggleGroup(group: AccountGroup) {
    setDraft((prev) => ({
      ...prev,
      groups: prev.groups.includes(group) ? prev.groups.filter((item) => item !== group) : [...prev.groups, group],
    }));
  }

  function toggleSource(id: string) {
    setDraft((prev) => ({
      ...prev,
      sourceIds: prev.sourceIds.includes(id) ? prev.sourceIds.filter((item) => item !== id) : [...prev.sourceIds, id],
    }));
  }

  function toggleTag(id: string) {
    setDraft((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(id) ? prev.tagIds.filter((item) => item !== id) : [...prev.tagIds, id],
    }));
  }

  return (
    <SheetFrame visible={visible} title="فیلتر" onClose={onClose} confirm={{ label: 'اعمال فیلتر', onClick: () => onConfirm(draft) }}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>گروه حساب</h3>
        <div className={styles.chips}>
          {ACCOUNT_GROUPS.map((group) => {
            const active = draft.groups.includes(group);
            return (
              <button
                key={group}
                type="button"
                className={`${styles.chip} ${active ? styles.chipActive : ''}`}
                aria-pressed={active}
                onClick={() => toggleGroup(group)}
              >
                {/* The same swatch the donut paints, so the two screens name the
                    group the same way. */}
                <span className={styles.dot} style={{ background: groupColor(group) } as CSSProperties} aria-hidden="true" />
                {ACCOUNT_GROUP_LABEL[group]}
              </button>
            );
          })}
        </div>
      </section>

      {sources.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>منبع مالی</h3>
          <div className={styles.chips}>
            {sources.map((source) => {
              const active = draft.sourceIds.includes(source.id);
              return (
                <button
                  key={source.id}
                  type="button"
                  className={`${styles.chip} ${active ? styles.chipActive : ''}`}
                  aria-pressed={active}
                  onClick={() => toggleSource(source.id)}
                >
                  {source.name}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {tags.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>برچسب‌ها</h3>
          <div className={styles.chips}>
            {tags.map((tag) => {
              const active = draft.tagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  className={`${styles.chip} ${active ? styles.chipActive : ''}`}
                  aria-pressed={active}
                  onClick={() => toggleTag(tag.id)}
                >
                  <span className={styles.dot} style={{ background: tag.color ?? tagColor(tag.name) } as CSSProperties} aria-hidden="true" />
                  {tag.name}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {isFilterActive(draft) && (
        <button type="button" className={styles.clear} onClick={() => setDraft(EMPTY_FILTER)}>
          پاک کردن فیلترها
        </button>
      )}
    </SheetFrame>
  );
}
