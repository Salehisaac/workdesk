import { CalendarOutline, CheckCircleOutline, TextOutline } from 'antd-mobile-icons';
import { formatShortDate, isSameDay, startOfDay, today, toPersianDigits } from '../../../../shared/date/jalali';
import { tagColor } from '../job/tagColor';
import { JOB_STATUS_LABEL } from '../../types';
import type { Job } from '../../types';
import styles from './JobCard.module.css';

/** Beyond this the avatars stop being faces and start being a smear. */
const MAX_VISIBLE_AVATARS = 3;

/** How urgent the deadline is — drives the date's colour, nothing else. */
function dueTone(due: Date): 'overdue' | 'today' | 'upcoming' {
  const now = today();
  if (isSameDay(due, now)) return 'today';
  return startOfDay(due) < now ? 'overdue' : 'upcoming';
}

interface JobCardProps {
  job: Job;
  onOpen: () => void;
}

export function JobCard({ job, onOpen }: JobCardProps) {
  const due = job.dueAt ? new Date(job.dueAt) : null;
  // The API always sends these as arrays, but a board is a list of many cards —
  // one record missing a collection shouldn't blank the whole project.
  const checklist = job.checklist ?? [];
  const tags = job.tags ?? [];
  const assignees = job.assignees ?? [];
  const doneCount = checklist.filter((item) => item.done).length;
  const visibleAvatars = assignees.slice(0, MAX_VISIBLE_AVATARS);
  const hiddenAvatars = assignees.length - visibleAvatars.length;

  // The whole card is the control that opens the job for editing. A <button>
  // rather than a click handler on the <article> because that is what gets
  // keyboard focus, Enter/Space and the right role for free — and the card has
  // no interactive children to nest inside it.
  return (
    <button type="button" className={styles.card} onClick={onOpen} aria-label={`ویرایش ${job.title}`}>
      <div className={styles.top}>
        <h3 className={styles.title}>{job.title}</h3>
        {/* Shape + colour, and the status name is in the title attribute and
            the label below — the square is never the only carrier. */}
        <span className={styles.status} data-status={job.status} title={JOB_STATUS_LABEL[job.status]}>
          <span className={styles.srOnly}>{JOB_STATUS_LABEL[job.status]}</span>
        </span>
      </div>

      {tags.length > 0 && (
        <div className={styles.tags}>
          {tags.map((tag) => (
            <span key={tag.id} className={styles.tag} style={{ background: tag.color ?? tagColor(tag.name) }}>
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {(due || checklist.length > 0 || job.description || assignees.length > 0) && (
        <div className={styles.footer}>
          <div className={styles.meta}>
            {due && (
              <span className={styles.metaItem} data-tone={dueTone(due)}>
                <CalendarOutline className={styles.metaIcon} />
                {formatShortDate(due)}
              </span>
            )}
            {checklist.length > 0 && (
              <span className={styles.metaItem} title="چک لیست">
                <CheckCircleOutline className={styles.metaIcon} />
                {toPersianDigits(doneCount)}/{toPersianDigits(checklist.length)}
              </span>
            )}
            {job.description && (
              <span className={styles.metaItem} title="این کار شرح دارد">
                <TextOutline className={styles.metaIcon} />
              </span>
            )}
          </div>

          {assignees.length > 0 && (
            <div className={styles.avatars}>
              {visibleAvatars.map((member) => (
                <span key={member.id} className={styles.avatar} title={member.displayName}>
                  {member.displayName.trim().charAt(0) || '؟'}
                </span>
              ))}
              {hiddenAvatars > 0 && <span className={styles.avatarMore}>+{toPersianDigits(hiddenAvatars)}</span>}
            </div>
          )}
        </div>
      )}
    </button>
  );
}
