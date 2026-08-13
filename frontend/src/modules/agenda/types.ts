/**
 * The agenda is a read-only *view* over the existing domain modules (project,
 * meeting, note) — one flat item shape the calendar and the day dashboard can
 * both index by day. Deliberately not a parallel data model: nothing is stored
 * or fetched as an AgendaItem, they're projected from the real entities in
 * ./api.ts and thrown away on the next render.
 */

/**
 * What can land on a calendar day.
 *
 * Note that a *project* isn't one of these. A project runs for weeks or months
 * and has no single date — what it has is Lists, and each list has Jobs, and a
 * job carries the deadline. So the calendar's project dimension is `job`: the
 * پروژه‌ها section on a given day is that day's job deadlines, not the projects
 * that happened to be created then.
 */
export type AgendaKind = 'session' | 'decision' | 'job' | 'note' | 'reminder';

/** The three dashboard sections. Sessions and decisions share one, per design. */
export type AgendaGroup = 'meetings' | 'projects' | 'notes' | 'reminders';

/**
 * What the dashboard can render as a collapsible box: the four groups above,
 * plus «معوقه‌ها».
 *
 * Overdue is deliberately *not* an AgendaGroup. A group is a kind of thing and
 * every item has exactly one; معوقه‌ها is a state a job or a مصوبه falls into and
 * then leaves again once it's closed — so it cuts across the groups instead of
 * sitting beside them, and it isn't scoped to the selected day the way they are.
 */
export type AgendaSectionKey = AgendaGroup | 'overdue';

export const AGENDA_GROUP_OF: Record<AgendaKind, AgendaGroup> = {
  session: 'meetings',
  decision: 'meetings',
  job: 'projects',
  note: 'notes',
  reminder: 'reminders',
};

export const AGENDA_KIND_LABEL: Record<AgendaKind, string> = {
  session: 'جلسه',
  decision: 'مصوبه',
  job: 'کار',
  note: 'یادداشت',
  reminder: 'یادآور',
};

/**
 * One accent per kind, from tokens.css. Kept beside the labels so a calendar
 * dot and the dashboard section it belongs to can't drift apart.
 */
export const AGENDA_KIND_COLOR: Record<AgendaKind, string> = {
  session: 'var(--wd-kind-session)',
  decision: 'var(--wd-kind-decision)',
  job: 'var(--wd-kind-job)',
  note: 'var(--wd-kind-note)',
  reminder: 'var(--wd-kind-reminder)',
};

export interface AgendaItem {
  /** Unique across kinds — the source id is prefixed, ids only collide per-table. */
  id: string;
  kind: AgendaKind;
  title: string;
  /** One line of context under the title: project name, parent session, excerpt. */
  subtitle: string | null;
  /** Local-midnight-or-later Date placing the item on a calendar day. */
  date: Date;
  /** Whether `date`'s time-of-day means anything (a session has one, a note doesn't). */
  hasTime: boolean;
  /** «آنلاین» / a room name / null. */
  location: string | null;
  /** Human-readable status chip, when the entity has a status. */
  status: string | null;
  /**
   * The deadline day has passed and somebody still owes this — «معوق».
   *
   * Only a job and a مصوبه can be: they're the two kinds whose date is a
   * deadline someone is answerable for. A session's date is when it starts, a
   * reminder's is when it fires and a note's is when it was written — none of
   * those is a debt, so none of them ever goes overdue. Decided from the source
   * entity's own status in ./api.ts, since `status` above is a display label by
   * the time it reaches here.
   */
  overdue: boolean;
  /** Existing in-app route this item opens, when one exists yet. */
  to: string | null;
}
