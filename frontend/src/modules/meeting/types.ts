/**
 * Meetings module — «مخزن جلسه»: جلسات و مصوبات.
 *
 * Same camelCase JSON and ISO-8601 timestamp conventions as the Project module.
 * The backend implements these now (app/http/controllers/session_controller.go,
 * decision_controller.go) — the queries in ./api.ts still go through
 * getCollection, which reads a missing route as an empty list, so an older
 * server degrades to empty sections instead of an error screen.
 */
import type { PickedItem } from '../../bridge/types';

export type SessionStatus = 'notStarted' | 'inProgress' | 'done' | 'canceled';

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  notStarted: 'آغاز نشده',
  inProgress: 'در حال برگزاری',
  done: 'برگزار شده',
  canceled: 'لغو شده',
};

/** Order the status sheet offers them in — the natural progression, then the exit. */
export const SESSION_STATUSES: SessionStatus[] = ['notStarted', 'inProgress', 'done', 'canceled'];

export interface Session {
  id: string;
  title: string;
  /** The project this session belongs to, when it belongs to one. */
  projectId: string | null;
  /** Denormalized for display, so the agenda doesn't have to join client-side. */
  projectName: string | null;
  /** ISO 8601, with a meaningful time-of-day — this is when the session starts. */
  startsAt: string;
  /** Physical place. Null when `isOnline`, which is its own kind of location. */
  location: string | null;
  isOnline: boolean;
  status: SessionStatus;
  memberCount: number;
}

/**
 * A picked member, plus the one thing a project member has no equivalent of.
 *
 * A project announces itself by adding people to a group they can see; a session
 * has no group, so the invite DM *is* the announcement. `notifiedAt` is null
 * when the bot couldn't reach them — normally because they've never started it —
 * and the session screen says so rather than implying everyone was told.
 */
export interface SessionMember extends PickedItem {
  role: 'owner' | 'member';
  notifiedAt: string | null;
}

/**
 * «دستور جلسه» — one line of the meeting's running order.
 *
 * The counterpart of a Decision, facing the other way. An agenda item is written
 * before the meeting and is spent inside it, so what it carries is a duration —
 * a slice of the session's own time. A مصوبه comes out of the meeting and
 * reaches into somebody's calendar, so what it carries is a deadline. That is
 * the whole difference between `durationMinutes` here and `dueAt` there.
 *
 * Note the name: `modules/agenda` is the home calendar («تقویم»), nothing to do
 * with this. Inside the meeting module, "agenda" always means دستور جلسه.
 */
export interface SessionAgenda {
  id: string;
  sessionId: string;
  title: string;
  description: string | null;
  /** How long it should take, in minutes. Null when nobody budgeted it. */
  durationMinutes: number | null;
  /** The «مسئول اجرایی» — one of the session's members, or nobody. */
  assigneeId: string | null;
  assigneeName: string | null;
}

export interface CreateAgendaInput {
  title: string;
  description?: string;
  /** Minutes — the picker's hours and minutes, already summed. Omit for none. */
  durationMinutes?: number;
  /** A member of the session it's being added to, or omitted. */
  assigneeId?: string;
}

export interface SessionDetail extends Session {
  members: SessionMember[];
  /** In the order it was written — an agenda is a sequence, not a set. */
  agendas: SessionAgenda[];
  decisions: Decision[];
}

export interface CreateSessionInput {
  title: string;
  /** ISO 8601 carrying the device's offset — see toLocalIso. */
  startsAt: string;
  /** Omitted when `isOnline`; the backend drops it in that case anyway. */
  location?: string;
  isOnline: boolean;
  /** Optional filing under a project the caller belongs to. */
  projectId?: string;
  /** Everyone to invite. The creator is added as owner server-side. */
  members: PickedItem[];
}

export type DecisionStatus = 'open' | 'done' | 'canceled';

export const DECISION_STATUS_LABEL: Record<DecisionStatus, string> = {
  open: 'در انتظار اجرا',
  done: 'انجام شد',
  canceled: 'لغو شده',
};

export const DECISION_STATUSES: DecisionStatus[] = ['open', 'done', 'canceled'];

/** A resolution taken in a session — «مصوبه». */
export interface Decision {
  id: string;
  title: string;
  description: string | null;
  /** The session it was decided in, when it came out of one. */
  sessionId: string | null;
  sessionTitle: string | null;
  /** Which «دستور جلسه» produced it — null when it came out of none of them. */
  agendaId: string | null;
  agendaTitle: string | null;
  /** ISO 8601 — the «سررسید». This is what places it on the calendar. */
  dueAt: string;
  /** Who owes it — one of the session's members, or nobody in particular. */
  assigneeId: string | null;
  /** Denormalized display name of whoever it's assigned to. */
  assigneeName: string | null;
  status: DecisionStatus;
}

export interface CreateDecisionInput {
  title: string;
  description?: string;
  /** ISO 8601 carrying the device's offset — see toLocalIso. */
  dueAt: string;
  /** An agenda item of the session it's being recorded in, or omitted. */
  agendaId?: string;
  /** A member of the session it's being recorded in, or omitted. */
  assigneeId?: string;
}
