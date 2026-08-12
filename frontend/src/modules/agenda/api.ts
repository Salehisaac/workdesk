import { useMemo } from 'react';
import { toDayKey, toPersianDigits } from '../../shared/date/jalali';
import { useSessions, useDecisions } from '../meeting/api';
import { DECISION_STATUS_LABEL, SESSION_STATUS_LABEL } from '../meeting/types';
import type { Decision, Session } from '../meeting/types';
import { useNotes } from '../note/api';
import type { Note } from '../note/types';
import { useProjects } from '../project/api';
import type { Project } from '../project/types';
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
const KIND_ORDER: Record<AgendaKind, number> = { session: 0, decision: 1, project: 2, note: 3 };

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

function projectToItem(project: Project): AgendaItem {
  return {
    id: `project:${project.id}`,
    kind: 'project',
    title: project.name,
    subtitle: `${toPersianDigits(project.memberCount)} عضو`,
    // A project has no schedule — createdAt is its only date field, so the day
    // it was started is the day it shows up on. Same rule the calendar dots use.
    date: new Date(project.createdAt),
    hasTime: false,
    location: null,
    status: project.visibility === 'public' ? 'عمومی' : 'خصوصی',
    to: `/projects/${project.id}`,
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
  const projects = useProjects();
  const sessions = useSessions();
  const decisions = useDecisions();
  const notes = useNotes();

  const items = useMemo<AgendaItem[]>(
    () => [
      ...(sessions.data ?? []).map(sessionToItem),
      ...(decisions.data ?? []).map(decisionToItem),
      ...(projects.data ?? []).map(projectToItem),
      ...(notes.data ?? []).map(noteToItem),
    ],
    [sessions.data, decisions.data, projects.data, notes.data],
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
      isLoading: projects.isLoading || sessions.isLoading || decisions.isLoading || notes.isLoading,
      isError: projects.isError || sessions.isError || decisions.isError || notes.isError,
    };
  }, [
    items,
    projects.isLoading,
    projects.isError,
    sessions.isLoading,
    sessions.isError,
    decisions.isLoading,
    decisions.isError,
    notes.isLoading,
    notes.isError,
  ]);
}
