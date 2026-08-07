import { Avatar, Button, Dialog, List, SwipeAction } from 'antd-mobile';
import { AddOutline, UserAddOutline } from 'antd-mobile-icons';
import { bridge } from '../../../../bridge';
import type { PickedItem } from '../../../../bridge/types';
import styles from './StepMembers.module.css';

interface StepMembersProps {
  members: PickedItem[];
  onChange: (members: PickedItem[]) => void;
}

function sameItem(a: PickedItem, b: PickedItem) {
  return a.id === b.id && a.source === b.source;
}

// Stand-in for bridge.pick() while it's unreliable on real devices (working
// on Android, not confirmed elsewhere — see conversation). Real account,
// not fixture data, so it's a valid member end-to-end, not just UI filler.
// Remove once pick() is dependable enough not to need a bypass.
const SAMPLE_USER: PickedItem = {
  id: '1271266967',
  source: 'users',
  displayName: 'دکتر آل اسحاق',
  username: 'doctor_al',
  phone: '989944993236',
};

export function StepMembers({ members, onChange }: StepMembersProps) {
  async function handlePick() {
    // Confirmed API — plan section 4. The picker UI is entirely native; we
    // only ever receive what the user chose to share.
    try {
      const picked = await bridge.pick({ sources: ['users', 'contacts'], multiple: true, search: true });
      const merged = [...members];
      for (const item of picked) {
        if (!merged.some((existing) => sameItem(existing, item))) {
          merged.push(item);
        }
      }
      onChange(merged);
    } catch (error) {
      // Dialog, not Toast — this needs to stay on screen long enough to
      // actually read/screenshot on a real device, where there's no devtools
      // console to fall back on.
      Dialog.alert({
        title: 'انتخاب مخاطب با خطا مواجه شد',
        content: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function handleRemove(item: PickedItem) {
    onChange(members.filter((existing) => !sameItem(existing, item)));
  }

  function handleAddSampleUser() {
    if (members.some((existing) => sameItem(existing, SAMPLE_USER))) return;
    onChange([...members, SAMPLE_USER]);
  }

  return (
    <div className={styles.wrap}>
      <Button block fill="outline" color="primary" onClick={handlePick}>
        <AddOutline /> انتخاب مخاطب
      </Button>
      <Button block fill="outline" onClick={handleAddSampleUser}>
        <UserAddOutline /> افزودن کاربر نمونه
      </Button>

      {members.length > 0 && (
        <List className={styles.list}>
          {members.map((member) => (
            <SwipeAction
              key={`${member.source}-${member.id}`}
              rightActions={[{ key: 'remove', text: 'حذف', color: 'danger', onClick: () => handleRemove(member) }]}
            >
              <List.Item
                prefix={<Avatar src="" style={{ '--size': '36px', '--border-radius': '50%' }} />}
                description={member.username ? `@${member.username}` : member.phone}
              >
                {member.displayName}
              </List.Item>
            </SwipeAction>
          ))}
        </List>
      )}
    </div>
  );
}
