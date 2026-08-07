import { Avatar, Button, List, SwipeAction } from 'antd-mobile';
import { AddOutline } from 'antd-mobile-icons';
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

export function StepMembers({ members, onChange }: StepMembersProps) {
  async function handlePick() {
    // Confirmed API — plan section 4. The picker UI is entirely native; we
    // only ever receive what the user chose to share.
    const picked = await bridge.pick({ sources: ['users', 'contacts'], multiple: true, search: true });
    const merged = [...members];
    for (const item of picked) {
      if (!merged.some((existing) => sameItem(existing, item))) {
        merged.push(item);
      }
    }
    onChange(merged);
  }

  function handleRemove(item: PickedItem) {
    onChange(members.filter((existing) => !sameItem(existing, item)));
  }

  return (
    <div className={styles.wrap}>
      <Button block fill="outline" color="primary" onClick={handlePick}>
        <AddOutline /> انتخاب مخاطب
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
