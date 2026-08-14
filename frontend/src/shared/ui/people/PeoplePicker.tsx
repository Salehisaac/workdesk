import { Dialog } from 'antd-mobile';
import { AddOutline, CloseOutline } from 'antd-mobile-icons';
import { useState, type CSSProperties } from 'react';
import { bridge } from '../../../bridge';
import type { PickedItem } from '../../../bridge/types';
import { monogramGradient, monogramInitial, paletteForSeed } from '../../brand/monogram';
import styles from './PeoplePicker.module.css';

interface PeoplePickerProps {
  members: PickedItem[];
  /** The signed-in user, who always leads the rail. Empty while /me is in flight. */
  ownerName: string;
  onChange: (members: PickedItem[]) => void;
  /** Section heading — «هم‌تیمی‌ها» for a project, «شرکت‌کنندگان» for a session. */
  title: string;
  /** What the owner's chip says under their name. */
  ownerRoleLabel: string;
}

function sameItem(a: PickedItem, b: PickedItem) {
  return a.id === b.id && a.source === b.source;
}

/**
 * Who is in the thing being created.
 *
 * A rail of avatar chips rather than a list with swipe-to-delete rows: the
 * members of a small team are a set you glance at, not a list you scroll, and
 * removing someone you just added by mistake should not depend on discovering
 * that the row can be swiped. Every chip carries its own ✕.
 *
 * The owner leads the rail and can't be removed — the backend adds the creator
 * as owner regardless of what this sends (project_controller.go,
 * session_controller.go), so showing them is the honest count, not a courtesy.
 *
 * Shared by the project, session and ledger create screens because the
 * interaction is identical; only the copy differs, which is what the label props
 * are for. What the three flows *do* with the list is where they diverge — a
 * project adds these people to a group, while a session and a ledger message
 * each of them a link.
 *
 * It carries no explanatory line of its own: what can and can't be changed after
 * creation is the guide's subject, not this component's.
 */
export function PeoplePicker({ members, ownerName, onChange, title, ownerRoleLabel }: PeoplePickerProps) {
  // Whether the client is holding an unanswered pick request. Tracked only so
  // the button can say so: bridge.pick() now waits up to 45s for a reply, and
  // a button that looks tappable but does nothing for that long reads as a
  // broken app rather than as a client that isn't answering.
  const [picking, setPicking] = useState(false);

  async function handlePick() {
    if (picking) return;
    setPicking(true);
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
    } finally {
      setPicking(false);
    }
  }

  const ownerLabel = ownerName || 'شما';

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        <span className={styles.count}>{members.length + 1} نفر</span>
      </div>

      <div className={styles.rail}>
        <button type="button" className={styles.add} onClick={handlePick} disabled={picking}>
          <span className={styles.addIcon} aria-hidden="true">
            <AddOutline />
          </span>
          <span className={styles.addLabel}>{picking ? 'در انتظار رساگرام…' : 'افزودن'}</span>
        </button>

        <div className={styles.chip}>
          <span
            className={styles.chipAvatar}
            style={{ background: monogramGradient(paletteForSeed('owner')) } as CSSProperties}
            aria-hidden="true"
          >
            {monogramInitial(ownerLabel) || '؟'}
          </span>
          <span className={styles.chipName}>{ownerLabel}</span>
          <span className={styles.chipRole}>{ownerRoleLabel}</span>
        </div>

        {members.map((member) => (
          <div key={`${member.source}-${member.id}`} className={styles.chip}>
            <span
              className={styles.chipAvatar}
              style={{ background: monogramGradient(paletteForSeed(member.id)) } as CSSProperties}
              aria-hidden="true"
            >
              {monogramInitial(member.displayName) || '؟'}
            </span>
            <span className={styles.chipName}>{member.displayName}</span>
            <span className={styles.chipRole}>{member.username ? `@${member.username}` : member.phone ?? 'عضو'}</span>

            <button
              type="button"
              className={styles.chipRemove}
              aria-label={`حذف ${member.displayName}`}
              onClick={() => onChange(members.filter((existing) => !sameItem(existing, member)))}
            >
              <CloseOutline />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
