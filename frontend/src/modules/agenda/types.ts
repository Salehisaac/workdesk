/**
 * The agenda is a read-only *view* over the existing domain modules (project,
 * meeting, note) — one flat item shape the calendar and the day dashboard can
 * both index by day. Deliberately not a parallel data model: nothing is stored
 * or fetched as an AgendaItem, they're projected from the real entities in
 * ./api.ts and thrown away on the next render.
 */

export type AgendaKind = 'session' | 'decision' | 'project' | 'note';

/** The three dashboard sections. Sessions and decisions share one, per design. */
export type AgendaGroup = 'meetings' | 'projects' | 'notes';

export const AGENDA_GROUP_OF: Record<AgendaKind, AgendaGroup> = {
  session: 'meetings',
  decision: 'meetings',
  project: 'projects',
  note: 'notes',
};

export const AGENDA_KIND_LABEL: Record<AgendaKind, string> = {
  session: 'جلسه',
  decision: 'مصوبه',
  project: 'پروژه',
  note: 'یادداشت',
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
  /** Existing in-app route this item opens, when one exists yet. */
  to: string | null;
}
