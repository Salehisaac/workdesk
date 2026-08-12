import { Input, Popup, Toast } from 'antd-mobile';
import { AddOutline, CheckOutline, CloseOutline } from 'antd-mobile-icons';
import { useEffect, useState } from 'react';
import { useCreateProjectTag, useProjectTags } from '../../api';
import { tagColor } from './tagColor';
import styles from './JobSheets.module.css';

interface JobTagSheetProps {
  visible: boolean;
  projectId: string;
  selectedIds: string[];
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}

/**
 * Tags live on the project, so creating one here adds it to the pool every job
 * in every list of this project can pick from — that's why the new-tag field
 * writes through `useCreateProjectTag` immediately instead of holding the name
 * in the job's payload. Newly created tags come back selected.
 */
export function JobTagSheet({ visible, projectId, selectedIds, onClose, onConfirm }: JobTagSheetProps) {
  const [draft, setDraft] = useState<string[]>(selectedIds);
  const [name, setName] = useState('');
  const tags = useProjectTags(projectId, visible);
  const createTag = useCreateProjectTag(projectId);

  useEffect(() => {
    if (visible) setDraft(selectedIds);
  }, [visible, selectedIds]);

  function toggle(id: string) {
    setDraft((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || createTag.isPending) return;
    try {
      const created = await createTag.mutateAsync({ name: trimmed, color: tagColor(trimmed) });
      setDraft((prev) => [...prev, created.id]);
      setName('');
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'ساخت برچسب با خطا مواجه شد' });
    }
  }

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

        <div className={styles.sheetHead}>
          <button type="button" className={styles.headConfirm} onClick={() => onConfirm(draft)} aria-label="تأیید برچسب‌ها">
            <CheckOutline />
          </button>
          <span className={styles.headTitle}>برچسب‌ها</span>
          <button type="button" className={styles.headClose} onClick={onClose} aria-label="بستن">
            <CloseOutline />
          </button>
        </div>

        <div className={styles.newTagRow}>
          <Input
            className={styles.newTagInput}
            placeholder="برچسب جدید بنویس"
            value={name}
            onChange={setName}
            onEnterPress={handleCreate}
          />
          <button
            type="button"
            className={styles.newTagAdd}
            onClick={handleCreate}
            disabled={!name.trim() || createTag.isPending}
            aria-label="ساخت برچسب جدید"
          >
            <AddOutline />
          </button>
        </div>

        <div className={styles.sheetBody}>
          {tags.isLoading && <p className={styles.empty}>در حال بارگذاری…</p>}
          {!tags.isLoading && (tags.data?.length ?? 0) === 0 && (
            <p className={styles.empty}>هنوز برچسبی در این پروژه ساخته نشده است.</p>
          )}
          {tags.data?.map((tag) => {
            const checked = draft.includes(tag.id);
            return (
              <label key={tag.id} className={styles.pickRow}>
                <input type="checkbox" className={styles.checkbox} checked={checked} onChange={() => toggle(tag.id)} />
                <span className={styles.tagChip} style={{ background: tag.color ?? tagColor(tag.name) }}>
                  {tag.name}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </Popup>
  );
}
