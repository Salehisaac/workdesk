/**
 * Meetings module — «جلسات و مصوبات».
 *
 * The backend routes for these don't exist yet (API_CONTRACT.md is v1 /
 * Project-module only), so these shapes are the frontend's side of the
 * contract: same camelCase JSON convention and same ISO-8601 timestamp
 * convention the Project module already uses (`Project.createdAt`). Until the
 * routes land, the queries in ./api.ts resolve to empty lists — see
 * getCollection in shared/api/client.ts.
 */

export type SessionStatus = 'notStarted' | 'inProgress' | 'done' | 'canceled';

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  notStarted: 'آغاز نشده',
  inProgress: 'در حال برگزاری',
  done: 'برگزار شده',
  canceled: 'لغو شده',
};

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
}

export type DecisionStatus = 'open' | 'done' | 'canceled';

export const DECISION_STATUS_LABEL: Record<DecisionStatus, string> = {
  open: 'در انتظار اجرا',
  done: 'انجام شد',
  canceled: 'لغو شده',
};

/** A resolution taken in a session — «مصوبه». */
export interface Decision {
  id: string;
  title: string;
  /** The session it was decided in, when it came out of one. */
  sessionId: string | null;
  sessionTitle: string | null;
  /** ISO 8601 — the day it's due. This is what places it on the calendar. */
  dueAt: string;
  /** Denormalized display name of whoever it's assigned to. */
  assigneeName: string | null;
  status: DecisionStatus;
}
