import { useMemo } from 'react';
import { startOfDay, toDayKey, toPersianDigits, today } from '../../shared/date/jalali';
import type { CalendarMarker } from '../../shared/ui/calendar/types';
import { useSessions, useDecisions } from '../meeting/api';
import { DECISION_STATUS_LABEL, SESSION_STATUS_LABEL } from '../meeting/types';
import type { Decision, Session } from '../meeting/types';
import { useNotes } from '../note/api';
import { useReminders } from '../reminder/api';
import type { Reminder } from '../reminder/types';
import type { Note } from '../note/types';
import { useJobs } from '../project/api';
import { JOB_STATUS_LABEL } from '../project/types';
import type { Job, JobStatus } from '../project/types';
import { AGENDA_KIND_COLOR, AGENDA_KIND_LABEL } from './types';
import type { AgendaItem, AgendaKind } from './types';

export interface Agenda {
  /** dayKey → that day's items, already sorted. */
  byDay: ReadonlyMap<string, AgendaItem[]>;
  /** dayKey → which kinds occur that day, for the calendar's indicator dots. */
  kindsByDay: ReadonlyMap<string, AgendaKind[]>;
  /**
   * Everything past its deadline and still owed, longest-overdue first.
   *
   * Flat and *not* keyed by day, unlike the two maps above: a slipped deadline
   * is today's problem no matter which day it slipped on, so the dashboard's
   * «معوقه‌ها» box shows all of them at once whatever date is selected. They stay
   * in `byDay` as well, since a past day still has to list what was due on it —
   * it's the dashboard that decides an item appears in one box or the other.
   */
  overdue: AgendaItem[];
  /** True only while nothing has arrived yet — one slow source shouldn't blank the page. */
  isLoading: boolean;
  /** True when a source failed for a real reason (a missing route resolves to []). */
  isError: boolean;
}

// Ordering inside a day: the timed things first (a session at 9:00 is the day's
// anchor), then what came out of them, then the ambient stuff.
const KIND_ORDER: Record<AgendaKind, number> = { session: 0, decision: 1, reminder: 2, job: 3, note: 4 };

/**
 * Statuses that take a job off someone's plate for good. One of these and it can
 * never be «معوق» however far its deadline has slipped — nobody is going to do a
 * cancelled job, so counting it would fill the box with work that will never
 * happen. Mirrors CLOSED_STATUSES in project/report.ts on purpose: the desk's
 * «۳ مورد معوقه» and a project report's «۳ معوق» have to be the same three jobs.
 */
const CLOSED_JOB_STATUSES = new Set<JobStatus>(['done', 'canceled', 'rejected']);

/**
 * Overdue at *day* granularity, never by the instant: a deadline of today 14:40
 * is still today's work at 15:00 and only turns معوق tomorrow. That's the rule
 * the board's date colour and the project report's overdue count already use
 * (project/report.ts), and the three would contradict each other on screen if
 * this one counted hours instead.
 *
 * `todayStart` is passed in rather than read here so every item in one pass is
 * measured against the same midnight.
 */
function isPastDue(deadline: Date, todayStart: Date): boolean {
  return startOfDay(deadline) < todayStart;
}

function sessionToItem(session: Session): AgendaItem {
  return {
    id: `session:${session.id}`,
    kind: 'session',
    title: session.title,
    subtitle: session.projectName ? `جلسه در ${session.projectName}` : 'جلسه',
    date: new Date(session.startsAt),
    hasTime: true,
    // The link itself would be too long for a calendar row, and pressing it
    // isn't what a day view is for — the session's own screen has it.
    location: session.isOnline ? 'آنلاین' : 'حضوری',
    status: SESSION_STATUS_LABEL[session.status] ?? null,
    // A meeting that has been and gone isn't a debt — it either happened or it
    // didn't, and either way nobody owes it now. See AgendaItem.overdue.
    overdue: false,
    to: `/sessions/${session.id}`,
  };
}

function decisionToItem(decision: Decision, todayStart: Date): AgendaItem {
  const dueAt = new Date(decision.dueAt);
  return {
    id: `decision:${decision.id}`,
    kind: 'decision',
    title: decision.title,
    subtitle: decision.sessionTitle ? `مصوبه‌ی ${decision.sessionTitle}` : 'مصوبه',
    date: dueAt,
    hasTime: false,
    location: decision.assigneeName,
    status: DECISION_STATUS_LABEL[decision.status] ?? null,
    // «در انتظار اجرا» past its سررسید. The two exits (انجام شد / لغو شده) are
    // both settled, so only an open one can be late.
    overdue: decision.status === 'open' && isPastDue(dueAt, todayStart),
    // The meeting it came out of, when it still has one — a resolution is read
    // in the context of the session that produced it. Otherwise the مصوبات tab,
    // which is the only other place it appears.
    to: decision.sessionId ? `/sessions/${decision.sessionId}` : '/sessions',
  };
}

/** Only ever called for a job that has a `dueAt` — see the filter in useAgenda. */
function jobToItem(job: Job, todayStart: Date): AgendaItem {
  // «کار در <project> › <list>», falling back as either name goes missing.
  const context = [job.projectName, job.listName].filter(Boolean).join(' › ');
  const [first, ...rest] = job.assignees ?? [];
  const dueAt = new Date(job.dueAt!);
  return {
    id: `job:${job.id}`,
    kind: 'job',
    title: job.title,
    subtitle: context ? `کار در ${context}` : 'کار',
    date: dueAt,
    // A deadline carries a time, and it's the useful half of "due by" — the
    // agenda shows it the same way a session's start time is shown.
    hasTime: true,
    location: first ? (rest.length ? `${first.displayName} و ${toPersianDigits(rest.length)} نفر دیگر` : first.displayName) : null,
    status: JOB_STATUS_LABEL[job.status] ?? null,
    overdue: !CLOSED_JOB_STATUSES.has(job.status) && isPastDue(dueAt, todayStart),
    // The board is where a job lives; there's no per-job screen yet.
    to: `/projects/${job.projectId}`,
  };
}

/** Only ever called for a reminder that has a `remindAt` — see useAgenda. */
function reminderToItem(reminder: Reminder): AgendaItem {
  return {
    id: `reminder:${reminder.id}`,
    kind: 'reminder',
    title: reminder.title,
    subtitle: reminder.note,
    date: new Date(reminder.remindAt!),
    hasTime: true,
    location: null,
    // Whether the bot has delivered it yet — the one thing about a reminder
    // you can't tell from its own text.
    status: reminder.notifiedAt ? 'ارسال شد' : 'در انتظار ارسال',
    // A یادآور fires or it doesn't; there is nothing to still owe afterwards, so
    // it never lands in معوقه‌ها. See AgendaItem.overdue.
    overdue: false,
    to: '/reminders',
  };
}

function noteToItem(note: Note): AgendaItem {
  return {
    id: `note:${note.id}`,
    kind: 'note',
    title: note.title,
    subtitle: note.excerpt ?? note.projectName,
    date: new Date(note.createdAt),
    hasTime: false,
    location: null,
    status: null,
    // A note's date is when it was written — a fact, not a deadline.
    overdue: false,
    to: null,
  };
}

/**
 * Everything on the user's calendar, indexed by Jalali day.
 *
 * Each source keeps its own query (and its own cache entry), so a section that
 * has no backend yet costs one 404 and then sits at []; nothing here fabricates
 * items. The indexing is memoized on the four result arrays, so re-rendering on
 * every date tap doesn't rebuild the maps.
 */
export function useAgenda(): Agenda {
  const jobs = useJobs();
  const sessions = useSessions();
  const decisions = useDecisions();
  const notes = useNotes();
  const reminders = useReminders();

  const items = useMemo<AgendaItem[]>(() => {
    // One midnight for the whole pass, so two items with the same deadline can't
    // disagree about being late. Recomputed with the projection rather than per
    // render: a page left open across midnight keeps yesterday's answer until
    // the next refetch, which is the same trade the calendar's own `today()`
    // makes and is invisible in a session that lasts minutes.
    const todayStart = today();
    return [
      ...(sessions.data ?? []).map(sessionToItem),
      ...(decisions.data ?? []).map((decision) => decisionToItem(decision, todayStart)),
      // A job with no deadline isn't on any day, so it isn't on the calendar.
      ...(jobs.data ?? []).filter((job) => job.dueAt).map((job) => jobToItem(job, todayStart)),
      // A reminder with no time isn't on any day (the API shouldn't produce
      // one, but the field is nullable, so don't trust it).
      ...(reminders.data ?? []).filter((reminder) => reminder.remindAt).map(reminderToItem),
      ...(notes.data ?? []).map(noteToItem),
    ];
  }, [sessions.data, decisions.data, jobs.data, reminders.data, notes.data]);

  return useMemo(() => {
    const byDay = new Map<string, AgendaItem[]>();
    for (const item of items) {
      const key = toDayKey(item.date);
      const bucket = byDay.get(key);
      if (bucket) bucket.push(item);
      else byDay.set(key, [item]);
    }

    const kindsByDay = new Map<string, AgendaKind[]>();
    for (const [key, dayItems] of byDay) {
      dayItems.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.date.getTime() - b.date.getTime());
      // Deduped and kept in KIND_ORDER so a day's dots don't reshuffle between
      // renders just because the items arrived in a different order.
      kindsByDay.set(key, [...new Set(dayItems.map((item) => item.kind))]);
    }

    // Longest-overdue first: the box is a queue of debts, and the oldest one is
    // the one that has been ignored longest.
    const overdue = items.filter((item) => item.overdue).sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      byDay,
      kindsByDay,
      overdue,
      isLoading: jobs.isLoading || sessions.isLoading || decisions.isLoading || notes.isLoading || reminders.isLoading,
      isError: jobs.isError || sessions.isError || decisions.isError || notes.isError || reminders.isError,
    };
  }, [
    items,
    jobs.isLoading,
    jobs.isError,
    sessions.isLoading,
    sessions.isError,
    decisions.isLoading,
    decisions.isError,
    notes.isLoading,
    notes.isError,
    reminders.isLoading,
    reminders.isError,
  ]);
}

export interface AgendaCalendar {
  /** dayKey → indicator dots, ready for ExpandableJalaliCalendar. */
  markers: ReadonlyMap<string, readonly CalendarMarker[]>;
  /** dayKey → how many items that day holds, for "۳ مورد در این روز…" footnotes. */
  dayCounts: ReadonlyMap<string, number>;
}

/**
 * The agenda reshaped for whatever is showing a calendar — the home dashboard
 * and the date-picker sheet both need exactly this and nothing else, so the
 * mapping lives here once instead of in each of them.
 */
export function useAgendaCalendar(): AgendaCalendar {
  const agenda = useAgenda();

  return useMemo(() => {
    const markers = new Map<string, CalendarMarker[]>();
    for (const [dayKey, kinds] of agenda.kindsByDay) {
      markers.set(
        dayKey,
        kinds.map((kind) => ({ id: kind, color: AGENDA_KIND_COLOR[kind], label: AGENDA_KIND_LABEL[kind] })),
      );
    }

    const dayCounts = new Map<string, number>();
    for (const [dayKey, dayItems] of agenda.byDay) dayCounts.set(dayKey, dayItems.length);

    return { markers, dayCounts };
  }, [agenda.kindsByDay, agenda.byDay]);
}
