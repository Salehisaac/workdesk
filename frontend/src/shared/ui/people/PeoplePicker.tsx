import { Dialog } from 'antd-mobile';
import { AddOutline, CloseOutline } from 'antd-mobile-icons';
import type { CSSProperties } from 'react';
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
  /** The one thing about this member list that can't be fixed afterwards. */
  hint: string;
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
 * Shared by the project and session create screens because the interaction is
 * identical; only the copy differs, which is what the label props are for. What
 * the two flows *do* with the list is where they diverge — a project adds these
 * people to a group, a session messages each of them a link.
 */
export function PeoplePicker({ members, ownerName, onChange, title, ownerRoleLabel, hint }: PeoplePickerProps) {
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

  function handleAddSampleUser() {
    if (members.some((existing) => sameItem(existing, SAMPLE_USER))) return;
    onChange([...members, SAMPLE_USER]);
  }

  const ownerLabel = ownerName || 'شما';

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        <span className={styles.count}>{members.length + 1} نفر</span>
      </div>

      <div className={styles.rail}>
        <button type="button" className={styles.add} onClick={handlePick}>
          <span className={styles.addIcon} aria-hidden="true">
            <AddOutline />
          </span>
          <span className={styles.addLabel}>افزودن</span>
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

      {/* The one limit that can't be fixed after the fact — said here, where it
          can still change what someone does, instead of in the guide they read
          afterwards. */}
      <p className={styles.hint}>{hint}</p>

      <button type="button" className={styles.sampleUser} onClick={handleAddSampleUser}>
        افزودن کاربر نمونه (برای آزمایش)
      </button>
    </section>
  );
}
