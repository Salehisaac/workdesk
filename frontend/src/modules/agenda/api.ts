import { useMemo } from 'react';
import { toDayKey, toPersianDigits } from '../../shared/date/jalali';
import { useSessions, useDecisions } from '../meeting/api';
import { DECISION_STATUS_LABEL, SESSION_STATUS_LABEL } from '../meeting/types';
import type { Decision, Session } from '../meeting/types';
import { useNotes } from '../note/api';
import type { Note } from '../note/types';
import { useJobs } from '../project/api';
import { JOB_STATUS_LABEL } from '../project/types';
import type { Job } from '../project/types';
import type { AgendaItem, AgendaKind } from './types';

export interface Agenda {
  /** dayKey → that day's items, already sorted. */
  byDay: ReadonlyMap<string, AgendaItem[]>;
  /** dayKey → which kinds occur that day, for the calendar's indicator dots. */
  kindsByDay: ReadonlyMap<string, AgendaKind[]>;
  /** True only while nothing has arrived yet — one slow source shouldn't blank the page. */
  isLoading: boolean;
  /** True when a source failed for a real reason (a missing route resolves to []). */
  isError: boolean;
}

// Ordering inside a day: the timed things first (a session at 9:00 is the day's
// anchor), then what came out of them, then the ambient stuff.
const KIND_ORDER: Record<AgendaKind, number> = { session: 0, decision: 1, job: 2, note: 3 };

function sessionToItem(session: Session): AgendaItem {
  return {
    id: `session:${session.id}`,
    kind: 'session',
    title: session.title,
    subtitle: session.projectName ? `جلسه در ${session.projectName}` : 'جلسه',
    date: new Date(session.startsAt),
    hasTime: true,
    location: session.isOnline ? 'آنلاین' : session.location,
    status: SESSION_STATUS_LABEL[session.status] ?? null,
    to: null,
  };
}

function decisionToItem(decision: Decision): AgendaItem {
  return {
    id: `decision:${decision.id}`,
    kind: 'decision',
    title: decision.title,
    subtitle: decision.sessionTitle ? `مصوبه‌ی ${decision.sessionTitle}` : 'مصوبه',
    date: new Date(decision.dueAt),
    hasTime: false,
    location: decision.assigneeName,
    status: DECISION_STATUS_LABEL[decision.status] ?? null,
    to: null,
  };
}

/** Only ever called for a job that has a `dueAt` — see the filter in useAgenda. */
function jobToItem(job: Job): AgendaItem {
  // «کار در <project> › <list>», falling back as either name goes missing.
  const context = [job.projectName, job.listName].filter(Boolean).join(' › ');
  const [first, ...rest] = job.assignees ?? [];
  return {
    id: `job:${job.id}`,
    kind: 'job',
    title: job.title,
    subtitle: context ? `کار در ${context}` : 'کار',
    date: new Date(job.dueAt!),
    // A deadline carries a time, and it's the useful half of "due by" — the
    // agenda shows it the same way a session's start time is shown.
    hasTime: true,
    location: first ? (rest.length ? `${first.displayName} و ${toPersianDigits(rest.length)} نفر دیگر` : first.displayName) : null,
    status: JOB_STATUS_LABEL[job.status] ?? null,
    // The board is where a job lives; there's no per-job screen yet.
    to: `/projects/${job.projectId}`,
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

  const items = useMemo<AgendaItem[]>(
    () => [
      ...(sessions.data ?? []).map(sessionToItem),
      ...(decisions.data ?? []).map(decisionToItem),
      // A job with no deadline isn't on any day, so it isn't on the calendar.
      ...(jobs.data ?? []).filter((job) => job.dueAt).map(jobToItem),
      ...(notes.data ?? []).map(noteToItem),
    ],
    [sessions.data, decisions.data, jobs.data, notes.data],
  );

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

    return {
      byDay,
      kindsByDay,
      isLoading: jobs.isLoading || sessions.isLoading || decisions.isLoading || notes.isLoading,
      isError: jobs.isError || sessions.isError || decisions.isError || notes.isError,
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
  ]);
}
