import { Button, Popup, Toast } from 'antd-mobile';
import { useState } from 'react';
import type { PickedItem } from '../../../bridge/types';
import { PeoplePicker } from './PeoplePicker';
import styles from './AddMembersSheet.module.css';

interface AddMembersSheetProps {
  visible: boolean;
  /** «هم‌تیمی‌ها» for a project, «شرکت‌کنندگان» for a meeting, «اعضا» for a book. */
  title: string;
  /** One line under the heading saying what adding someone actually does here. */
  hint: string;
  submitting: boolean;
  onClose: () => void;
  /** Resolves when the members have been sent; the sheet closes and clears itself. */
  onSubmit: (members: PickedItem[]) => Promise<void>;
}

/**
 * Adding people to something that already exists — a project, a meeting, a book.
 *
 * Shared by all three because the interaction is the same one their create
 * screens already use (PeoplePicker), and only the sentence above it differs:
 * what happens to the person you add is not the same in the three modules, and
 * that is worth saying before the tap rather than after. A project puts them in
 * its Rasagram group; a meeting and a book have no group, so each messages them
 * a link instead.
 *
 * The picked list is local to the sheet and cleared on success, so the same
 * sheet reopened is empty rather than still holding the last batch.
 */
export function AddMembersSheet({ visible, title, hint, submitting, onClose, onSubmit }: AddMembersSheetProps) {
  const [members, setMembers] = useState<PickedItem[]>([]);

  async function handleSubmit() {
    if (submitting) return;
    if (members.length === 0) {
      Toast.show({ content: 'کسی را انتخاب کنید' });
      return;
    }

    try {
      await onSubmit(members);
      setMembers([]);
      onClose();
    } catch (error) {
      // The caller's own message when it has one — «قبلاً عضو است» and «به گروه
      // اضافه نشد» are different failures and the sheet stays open for both.
      Toast.show({ content: error instanceof Error ? error.message : 'افزودن عضو با خطا مواجه شد' });
    }
  }

  return (
    <Popup visible={visible} onMaskClick={onClose} bodyClassName={styles.sheet} destroyOnClose>
      <div className={styles.body}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.hint}>{hint}</p>

        {/* No owner chip: this is an addition to something that already has one,
            so the rail holds exactly what is about to be sent. */}
        <PeoplePicker
          members={members}
          ownerName=""
          showOwner={false}
          onChange={setMembers}
          title="افراد تازه"
          ownerRoleLabel=""
        />

        <Button block color="primary" size="large" loading={submitting} onClick={handleSubmit}>
          افزودن
        </Button>
      </div>
    </Popup>
  );
}
