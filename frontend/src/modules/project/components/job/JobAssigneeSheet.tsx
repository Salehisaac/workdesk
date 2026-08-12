import { Popup } from 'antd-mobile';
import { CheckOutline, CloseOutline } from 'antd-mobile-icons';
import { useEffect, useState } from 'react';
import type { ProjectMember } from '../../types';
import styles from './JobSheets.module.css';

interface JobAssigneeSheetProps {
  visible: boolean;
  /** The project's members — the only people a job can be assigned to. */
  members: ProjectMember[];
  selectedIds: string[];
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}

/**
 * Picks assignees from the project's own membership rather than opening the
 * bridge's global people picker: a job can only be given to someone who is in
 * the project, and `ProjectDetail.members` already has them.
 */
export function JobAssigneeSheet({ visible, members, selectedIds, onClose, onConfirm }: JobAssigneeSheetProps) {
  const [draft, setDraft] = useState<string[]>(selectedIds);

  // The sheet keeps its own draft so cancelling discards; re-seed it each time
  // it opens, or the second visit shows the first visit's abandoned edits.
  useEffect(() => {
    if (visible) setDraft(selectedIds);
  }, [visible, selectedIds]);

  function toggle(id: string) {
    setDraft((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
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

        {/* DOM order is right-to-left on screen: confirm sits on the leading
            (right) edge, dismiss on the trailing (left) one. */}
        <div className={styles.sheetHead}>
          <button type="button" className={styles.headConfirm} onClick={() => onConfirm(draft)} aria-label="تأیید افراد">
            <CheckOutline />
          </button>
          <span className={styles.headTitle}>افراد</span>
          <button type="button" className={styles.headClose} onClick={onClose} aria-label="بستن">
            <CloseOutline />
          </button>
        </div>

        <div className={styles.sheetBody}>
          {members.length === 0 ? (
            <p className={styles.empty}>عضوی در این پروژه نیست.</p>
          ) : (
            members.map((member) => {
              const checked = draft.includes(member.id);
              return (
                <label key={member.id} className={styles.pickRow}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={checked}
                    onChange={() => toggle(member.id)}
                  />
                  <span className={styles.avatar} aria-hidden="true">
                    {member.displayName.trim().charAt(0) || '؟'}
                  </span>
                  <span className={styles.pickLabel}>{member.displayName}</span>
                  {member.username && <span className={styles.pickMeta}>@{member.username}</span>}
                </label>
              );
            })
          )}
        </div>
      </div>
    </Popup>
  );
}
