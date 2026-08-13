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

export interface SessionDetail extends Session {
  members: SessionMember[];
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
  /** The session it was decided in, when it came out of one. */
  sessionId: string | null;
  sessionTitle: string | null;
  /** ISO 8601 — the day it's due. This is what places it on the calendar. */
  dueAt: string;
  /** Who owes it — one of the session's members, or nobody in particular. */
  assigneeId: string | null;
  /** Denormalized display name of whoever it's assigned to. */
  assigneeName: string | null;
  status: DecisionStatus;
}

export interface CreateDecisionInput {
  title: string;
  /** ISO 8601 carrying the device's offset — see toLocalIso. */
  dueAt: string;
  /** A member of the session it's being recorded in, or omitted. */
  assigneeId?: string;
}
