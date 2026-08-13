// Everything the project report shows, derived on the client from the two
// queries the board already has loaded (useProject + useJobs). No new endpoint:
// a report is a *view* of jobs, and the jobs are already in the cache — asking
// the backend to re-aggregate them would put the same numbers behind a second
// round trip and let the board and the report disagree while one is stale.
//
// Everything here is pure. The page below it only renders what these functions
// return, which keeps the arithmetic (what "معوق" means, how a percentage is
// rounded) in one place instead of scattered across six section components.
import { startOfDay, today } from '../../shared/date/jalali';
import { JOB_STATUSES } from './types';
import type { Job, JobStatus, ProjectDetail } from './types';

/**
 * Statuses that take a job off the board for good. A job in one of these can
 * never be «معوق» no matter how far its deadline has slipped — nobody is going
 * to work on a cancelled job, so counting it as overdue would inflate the
 * number with work that will never happen.
 */
const CLOSED_STATUSES = new Set<JobStatus>(['done', 'canceled', 'rejected']);

const MS_PER_DAY = 86_400_000;

export interface StatusSlice {
  status: JobStatus;
  count: number;
  /** 0–100, rounded — the segment's width in the part-to-whole bar. */
  share: number;
}

export interface ReportStats {
  total: number;
  done: number;
  /** Past its deadline and still open — see CLOSED_STATUSES. */
  overdue: number;
  /** No deadline at all, so invisible to every date-based number here. */
  undated: number;
  /** Share of jobs marked «انجام شده», 0–100 rounded. */
  completion: number;
  /** All six statuses, always, in JOB_STATUSES order — zeroes included so the
      legend keeps a stable row order between projects. */
  byStatus: StatusSlice[];
  /** Latest deadline among the jobs still open — the group's finish line. */
  lastDue: Date | null;
  /** Whole days from today to lastDue. Negative once that date has passed. */
  daysToLastDue: number | null;
}

/** A member, a tag, or one of the two "no owner"/"no tag" buckets. */
export interface ReportGroup {
  id: string;
  name: string;
  /** The tag's colour; null for people (their avatar carries identity). */
  color: string | null;
  /** True for the synthetic «بدون مسئول» / «بدون برچسب» buckets. */
  synthetic: boolean;
  stats: ReportStats;
}

export interface TimelineReport {
  /**
   * Done, with a deadline that hasn't passed.
   *
   * A Job carries no completion timestamp (see API_CONTRACT.md — only
   * `createdAt` and `dueAt`), so "finished on time" can't be measured
   * directly. This is the honest approximation available from the data:
   * finished, and its deadline is still ahead. A job finished *early* whose
   * deadline has since passed lands in `doneLate` — which is why the page
   * labels these «در مهلت» / «با تأخیر» rather than claiming a punctuality
   * rate.
   */
  doneInTime: number;
  /** Done, but the deadline is behind us. */
  doneLate: number;
  /** Open and past its deadline. */
  overdue: number;
  /** Nearest deadline still ahead, across the open jobs. */
  nextDue: Date | null;
  lastDue: Date | null;
  daysToLastDue: number | null;
}

export interface ProjectReport {
  overall: ReportStats;
  timeline: TimelineReport;
  /** Every project member, busiest first, then the unassigned bucket. */
  byMember: ReportGroup[];
  /** Every tag in use, busiest first, then the untagged bucket. */
  byTag: ReportGroup[];
}

/** Whole days between two calendar days — sign kept, so the past is negative. */
function daysUntil(date: Date, from: Date): number {
  return Math.round((startOfDay(date).getTime() - from.getTime()) / MS_PER_DAY);
}

function isOverdue(job: Job, now: Date): boolean {
  if (!job.dueAt || CLOSED_STATUSES.has(job.status)) return false;
  return startOfDay(new Date(job.dueAt)) < now;
}

function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

/**
 * The numbers for one bucket of jobs — the whole project, one member's share,
 * or one tag's. Same shape everywhere so the section components can render a
 * person and a tag with the same row.
 */
export function summarize(jobs: Job[], now: Date = today()): ReportStats {
  const counts = new Map<JobStatus, number>();
  let overdue = 0;
  let undated = 0;
  let lastDue: Date | null = null;

  for (const job of jobs) {
    counts.set(job.status, (counts.get(job.status) ?? 0) + 1);
    if (isOverdue(job, now)) overdue++;

    if (!job.dueAt) {
      undated++;
      continue;
    }
    // The finish line is drawn from the *open* jobs only: a project whose last
    // remaining work is due tomorrow is a day from done, however old the
    // deadline on something already delivered was.
    if (CLOSED_STATUSES.has(job.status)) continue;
    const due = new Date(job.dueAt);
    if (!lastDue || due > lastDue) lastDue = due;
  }

  const total = jobs.length;
  const done = counts.get('done') ?? 0;

  return {
    total,
    done,
    overdue,
    undated,
    completion: percent(done, total),
    byStatus: JOB_STATUSES.map((status) => {
      const count = counts.get(status) ?? 0;
      return { status, count, share: percent(count, total) };
    }),
    lastDue,
    daysToLastDue: lastDue ? daysUntil(lastDue, now) : null,
  };
}

function buildTimeline(jobs: Job[], now: Date): TimelineReport {
  let doneInTime = 0;
  let doneLate = 0;
  let overdue = 0;
  let nextDue: Date | null = null;
  let lastDue: Date | null = null;

  for (const job of jobs) {
    if (isOverdue(job, now)) overdue++;
    if (!job.dueAt) continue;

    const due = new Date(job.dueAt);
    const passed = startOfDay(due) < now;

    if (job.status === 'done') {
      if (passed) doneLate++;
      else doneInTime++;
      continue;
    }
    if (CLOSED_STATUSES.has(job.status)) continue;

    if (!lastDue || due > lastDue) lastDue = due;
    if (!passed && (!nextDue || due < nextDue)) nextDue = due;
  }

  return {
    doneInTime,
    doneLate,
    overdue,
    nextDue,
    lastDue,
    daysToLastDue: lastDue ? daysUntil(lastDue, now) : null,
  };
}

/** Busiest bucket first; ties broken by name so the order never flickers. */
function byWorkload(a: ReportGroup, b: ReportGroup): number {
  if (b.stats.total !== a.stats.total) return b.stats.total - a.stats.total;
  return a.name.localeCompare(b.name, 'fa');
}

/**
 * People, including members with nothing assigned — a member sitting at zero is
 * a finding, not an empty row to hide. A job with several assignees counts once
 * for each of them, so these totals deliberately sum to more than the project's.
 */
function groupByMember(project: ProjectDetail, jobs: Job[], now: Date): ReportGroup[] {
  const buckets = new Map<string, Job[]>();
  for (const member of project.members ?? []) buckets.set(member.id, []);

  const unassigned: Job[] = [];
  for (const job of jobs) {
    const assignees = job.assignees ?? [];
    if (assignees.length === 0) {
      unassigned.push(job);
      continue;
    }
    for (const assignee of assignees) {
      const bucket = buckets.get(assignee.id);
      // An assignee who has since left the project still owns their jobs on the
      // board, so give them a row rather than dropping the work.
      if (bucket) bucket.push(job);
      else buckets.set(assignee.id, [job]);
    }
  }

  const names = new Map<string, string>();
  for (const member of project.members ?? []) names.set(member.id, member.displayName);
  for (const job of jobs) {
    for (const assignee of job.assignees ?? []) {
      if (!names.has(assignee.id)) names.set(assignee.id, assignee.displayName);
    }
  }

  const groups: ReportGroup[] = [];
  for (const [id, memberJobs] of buckets) {
    groups.push({
      id,
      name: names.get(id) ?? 'عضو حذف‌شده',
      color: null,
      synthetic: false,
      stats: summarize(memberJobs, now),
    });
  }
  groups.sort(byWorkload);

  if (unassigned.length > 0) {
    groups.push({
      id: '__unassigned__',
      name: 'بدون مسئول',
      color: null,
      synthetic: true,
      stats: summarize(unassigned, now),
    });
  }
  return groups;
}

/** Same idea for tags — a job with three tags counts in all three. */
function groupByTag(jobs: Job[], now: Date): ReportGroup[] {
  const buckets = new Map<string, { name: string; color: string | null; jobs: Job[] }>();
  const untagged: Job[] = [];

  for (const job of jobs) {
    const tags = job.tags ?? [];
    if (tags.length === 0) {
      untagged.push(job);
      continue;
    }
    for (const tag of tags) {
      const bucket = buckets.get(tag.id);
      if (bucket) bucket.jobs.push(job);
      else buckets.set(tag.id, { name: tag.name, color: tag.color, jobs: [job] });
    }
  }

  const groups: ReportGroup[] = [];
  for (const [id, bucket] of buckets) {
    groups.push({
      id,
      name: bucket.name,
      color: bucket.color,
      synthetic: false,
      stats: summarize(bucket.jobs, now),
    });
  }
  groups.sort(byWorkload);

  if (untagged.length > 0) {
    groups.push({
      id: '__untagged__',
      name: 'بدون برچسب',
      color: null,
      synthetic: true,
      stats: summarize(untagged, now),
    });
  }
  return groups;
}

/**
 * The whole report for one project. `jobs` must already be filtered to this
 * project — the caller has the flat cross-project list and knows how to narrow
 * it (see useProjectReport in ./api.ts).
 */
export function buildProjectReport(project: ProjectDetail, jobs: Job[], now: Date = today()): ProjectReport {
  return {
    overall: summarize(jobs, now),
    timeline: buildTimeline(jobs, now),
    byMember: groupByMember(project, jobs, now),
    byTag: groupByTag(jobs, now),
  };
}
