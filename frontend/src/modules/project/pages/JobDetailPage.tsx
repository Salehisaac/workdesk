import { Button, DotLoading } from 'antd-mobile';
import {
  CalendarOutline,
  CheckCircleOutline,
  EditSOutline,
  ExclamationCircleOutline,
  RightOutline,
  TeamOutline,
  TextOutline,
  UnorderedListOutline,
} from 'antd-mobile-icons';
import type { CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../../shared/api/client';
import { useMe } from '../../../shared/api/me';
import { monogramGradient, monogramInitial, paletteForSeed } from '../../../shared/brand/monogram';
import { formatLongDate, formatTime, isSameDay, startOfDay, today, toPersianDigits } from '../../../shared/date/jalali';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { HomeButton } from '../../../shared/ui/HomeButton';
import { useJobs, useProject } from '../api';
import { STATUS_ICON } from '../components/statusIcon';
import { tagColor } from '../components/job/tagColor';
import { JOB_STATUS_LABEL } from '../types';
import styles from './JobDetailPage.module.css';

/** How urgent the deadline is — drives the date's colour, nothing else. Same three tones the card uses. */
function dueTone(due: Date): 'overdue' | 'today' | 'upcoming' {
  const now = today();
  if (isSameDay(due, now)) return 'today';
  return startOfDay(due) < now ? 'overdue' : 'upcoming';
}

/**
 * One job, to read — and the screen the group's announcement opens.
 *
 * That second job is why this page exists. Every new job is posted into its
 * list's topic (app/services/projectfeed.AnnounceJob) under «برای باز کردن کار
 * در اپ», and a forum topic is read by the whole project, not by the two people
 * allowed to edit the job. Pointing that link at the edit form meant everyone
 * else tapped it and landed on «دسترسی ندارید» — a message advertising a screen
 * its readers are refused. So a job now has a screen anyone in the project can
 * open, and the form is what «ویرایش» leads to for the two who may use it.
 *
 * It is the board's tap target too, for the same reason: a card that showed a
 * toast for everyone else was the same dead end one tap earlier.
 *
 * Read from the flat useJobs() query rather than a fetch of its own — there is
 * no GET /jobs/{id} (see JobEditPage), and that query is already warm for
 * anyone arriving from the board. A job that isn't in it is treated as gone,
 * which is also the honest answer for someone who isn't in its project: the
 * list only ever carries what the caller may see.
 */
export function JobDetailPage() {
  const { projectId, jobId } = useParams<{ projectId: string; jobId: string }>();
  const navigate = useNavigate();
  const project = useProject(projectId);
  const jobs = useJobs();
  const me = useMe();

  const job = (jobs.data ?? []).find((candidate) => candidate.id === jobId);

  /**
   * Who may edit or delete this job: whoever filed it, and the project's
   * creator. Mirrors the board's canManage and the backend's own check — this
   * screen only decides whether to draw the button, and the API decides the
   * rest.
   *
   * Phrased as "known to be mine" rather than JobEditPage's "known to be
   * someone else's" because the failure modes are opposite: there, `me` failing
   * must not lock someone out of their own job, so the screen opens; here it
   * only costs a button that would have been refused anyway.
   */
  const canManage =
    !!job &&
    !!project.data &&
    !!me.data &&
    (project.data.ownerRefId === me.data.id || job.createdBy === me.data.id);

  const backToBoard = () => navigate(`/projects/${projectId}`);

  /**
   * A 403 or 404 on the project isn't a failure to answer — it IS the answer.
   *
   * This is the one screen where that happens routinely: the link lives in a
   * forum topic, and a group's members and a project's members are not the same
   * set — anyone added to the group afterwards can tap a job they were never
   * given. Telling them the connection failed would send them back to retry
   * something that will never succeed.
   */
  const notMine = project.error instanceof ApiError && (project.error.status === 403 || project.error.status === 404);

  if (!notMine && (project.isError || jobs.isError)) {
    return (
      <div className={styles.page}>
        <Header onBack={backToBoard} />
        <EmptyState
          icon={<ExclamationCircleOutline />}
          title="ارتباط برقرار نشد"
          description="بارگذاری این کار با خطا مواجه شد. دوباره تلاش کنید."
        />
      </div>
    );
  }

  if (!notMine && (project.isLoading || jobs.isLoading)) {
    return (
      <div className={styles.page}>
        <Header onBack={backToBoard} />
        <EmptyState icon={<DotLoading />} title="در حال بارگذاری…" />
      </div>
    );
  }

  if (notMine || !job) {
    return (
      <div className={styles.page}>
        <Header onBack={backToBoard} />
        <EmptyState
          icon={<ExclamationCircleOutline />}
          title="این کار را نمی‌بینید"
          // Both readings at once, because the screen genuinely can't tell them
          // apart: the job may be gone, or the reader may simply not be in the
          // project it belongs to. «خانه» in the header is the way out for the
          // second — back leads to a board they can't open either.
          description="ممکن است حذف شده باشد، یا شما عضو پروژه‌ی آن نباشید. برای دسترسی از سازنده‌ی پروژه بخواهید شما را اضافه کند."
          action={
            <Button color="primary" onClick={() => navigate('/')}>
              رفتن به خانه
            </Button>
          }
        />
      </div>
    );
  }

  const due = job.dueAt ? new Date(job.dueAt) : null;
  // Defensive the same way JobCard is: one record missing a collection
  // shouldn't blank the screen someone opened from a chat message.
  const checklist = job.checklist ?? [];
  const tags = job.tags ?? [];
  const assignees = job.assignees ?? [];
  const doneCount = checklist.filter((item) => item.done).length;

  return (
    <div className={styles.page}>
      <Header
        onBack={backToBoard}
        onEdit={canManage ? () => navigate(`/projects/${projectId}/jobs/${job.id}/edit`) : undefined}
      />

      <div className={styles.body}>
        <section className={styles.hero}>
          {/* «#۲ در لیست بررسی» — the label the board puts on the card, plus
              where the card sits. Someone arriving from a chat message has not
              seen the board, so the job has to say where it lives. */}
          <div className={styles.breadcrumb}>
            {job.number !== null && <span className={styles.number}>{toPersianDigits(`#${job.number}`)}</span>}
            {job.listName && <span>در لیست {job.listName}</span>}
            {project.data?.name && <span>· {project.data.name}</span>}
          </div>

          <h1 className={styles.title}>{job.title}</h1>

          {/* Colour is never the only carrier of the status — the glyph and the
              label ride along with it, see STATUS_ICON. */}
          <span className={styles.status} data-status={job.status}>
            <span className={styles.statusIcon} aria-hidden="true">
              {STATUS_ICON[job.status]}
            </span>
            {JOB_STATUS_LABEL[job.status]}
          </span>

          {tags.length > 0 && (
            <div className={styles.tags}>
              {tags.map((tag) => (
                <span key={tag.id} className={styles.tag} style={{ background: tag.color ?? tagColor(tag.name) }}>
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {due && (
            <div className={styles.fact} data-tone={dueTone(due)}>
              <CalendarOutline aria-hidden="true" />
              مهلت: {formatLongDate(due)}، ساعت {formatTime(due)}
            </div>
          )}
        </section>

        {job.description && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <TextOutline aria-hidden="true" /> شرح
            </h2>
            {/* pre-wrap in the stylesheet: a description is typed with its own
                line breaks and they are part of what was written. */}
            <p className={styles.description}>{job.description}</p>
          </section>
        )}

        {assignees.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>
                <TeamOutline aria-hidden="true" /> مسئول‌ها
              </h2>
              <span className={styles.sectionCount}>{toPersianDigits(assignees.length)} نفر</span>
            </div>

            <div className={styles.rail}>
              {assignees.map((member) => (
                <div key={member.id} className={styles.chip}>
                  <span
                    className={styles.chipAvatar}
                    style={{ background: monogramGradient(paletteForSeed(member.id)) } as CSSProperties}
                    aria-hidden="true"
                  >
                    {monogramInitial(member.displayName) || '؟'}
                  </span>
                  <span className={styles.chipName}>{member.displayName}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {checklist.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>
                <UnorderedListOutline aria-hidden="true" /> چک‌لیست
              </h2>
              <span className={styles.sectionCount}>
                {toPersianDigits(doneCount)}/{toPersianDigits(checklist.length)}
              </span>
            </div>

            {/* Ticks are read here, not set: a checklist item is edited in the
                form, and only by the two people who may open it. */}
            <ul className={styles.checklist}>
              {checklist.map((item) => (
                <li key={item.id} className={styles.checkItem} data-done={item.done || undefined}>
                  <CheckCircleOutline className={styles.checkIcon} aria-hidden="true" />
                  <span className={styles.checkText}>{item.text}</span>
                  <span className={styles.srOnly}>{item.done ? 'انجام شده' : 'انجام نشده'}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Where the job's own conversation is: the list's topic in the
            project's group is where this job was announced, and going back to
            the board is one tap from «فعالیت‌ها» there. Said as a line rather
            than a button because the board is what «بازگشت» already leads to. */}
        <p className={styles.footNote}>گفتگوی این کار در موضوع «{job.listName ?? 'لیست'}» گروه پروژه دنبال می‌شود.</p>
      </div>
    </div>
  );
}

function Header({ onBack, onEdit }: { onBack: () => void; onEdit?: () => void }) {
  return (
    <header className={styles.header}>
      <button type="button" className={styles.back} onClick={onBack} aria-label="بازگشت">
        <RightOutline />
      </button>
      {/* Like the session screen, this is where a link out of the chat lands
          (startapp=job-<projectId>-<jobId>) — that reader never passed through
          the front door, and back leads to a board they have never seen. */}
      <HomeButton />
      <h1 className={styles.headerTitle}>کار</h1>
      {/* Takes the spacer's place rather than adding to the row, so the title
          stays centred whether or not this viewer may edit. */}
      {onEdit ? (
        <button type="button" className={styles.headerEdit} onClick={onEdit} aria-label="ویرایش کار">
          <EditSOutline />
        </button>
      ) : (
        <span className={styles.headerSpacer} aria-hidden="true" />
      )}
    </header>
  );
}
