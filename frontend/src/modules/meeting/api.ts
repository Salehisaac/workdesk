import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PickedItem } from '../../bridge/types';
import { apiClient, getCollection } from '../../shared/api/client';
import type {
  CreateAgendaInput,
  CreateDecisionInput,
  CreateSessionInput,
  Decision,
  DecisionStatus,
  Session,
  SessionAgenda,
  SessionDetail,
  SessionStatus,
} from './types';

// Both collections are fetched whole and filtered by day on the client, exactly
// like useProjects() does — the dashboard needs day markers across the whole
// visible month, not just the selected day, so a per-day endpoint would mean a
// request per cell. If these ever grow past a few hundred rows the query key is
// already shaped to take a date range without touching callers.
const meetingKeys = {
  sessions: ['sessions'] as const,
  session: (id: string) => ['sessions', id] as const,
  decisions: ['decisions'] as const,
};

export function useSessions() {
  return useQuery({
    queryKey: meetingKeys.sessions,
    queryFn: () => getCollection<Session>('/sessions'),
    retry: false,
  });
}

export function useSession(sessionId: string | undefined) {
  return useQuery({
    queryKey: meetingKeys.session(sessionId ?? ''),
    queryFn: () => apiClient.get<SessionDetail>(`/sessions/${sessionId}`),
    enabled: !!sessionId,
  });
}

export function useDecisions() {
  return useQuery({
    queryKey: meetingKeys.decisions,
    queryFn: () => getCollection<Decision>('/decisions'),
    retry: false,
  });
}

/**
 * Creating a session sends its invite messages server-side, so what comes back
 * already carries members[].notifiedAt — the caller shows who was actually
 * reached instead of promising delivery it can't see.
 *
 * Invalidates the flat session list, which is also the home calendar's source,
 * so a meeting created here appears on the calendar without a reload.
 */
export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSessionInput) => apiClient.post<SessionDetail>('/sessions', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meetingKeys.sessions }),
  });
}

/**
 * Status is the only thing a session's PATCH accepts — title, time and place are
 * what the invite message already told everyone, and changing them here would
 * leave every member holding a message that is now wrong.
 */
export function useUpdateSessionStatus(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: SessionStatus) => apiClient.patch<Session>(`/sessions/${sessionId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meetingKeys.sessions });
      queryClient.invalidateQueries({ queryKey: meetingKeys.session(sessionId) });
    },
  });
}

/**
 * Adding people to a meeting — its owner's alone.
 *
 * There is no group to add them to, so this sends each of them the same invite
 * message creation does; the response carries the whole meeting back, with the
 * new members' notifiedAt already stamped, so the screen can say who was reached.
 */
export function useAddSessionMembers(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (members: PickedItem[]) =>
      apiClient.post<SessionDetail>(`/sessions/${sessionId}/members`, { members }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meetingKeys.sessions });
      queryClient.invalidateQueries({ queryKey: meetingKeys.session(sessionId) });
    },
  });
}

/**
 * Deleting a meeting — its owner's alone (403 otherwise), and final for the
 * meeting itself: members and the running order go with it.
 *
 * Its مصوبات do NOT: a commitment outlives the room that made it, so
 * `decisions.session_id` is set to null rather than cascading. The decisions
 * query is invalidated all the same, since those rows just stopped naming a
 * meeting.
 *
 * The cached session detail is removed rather than invalidated — refetching a
 * session that no longer exists would only 404 behind a screen the user is
 * already leaving.
 */
export function useDeleteSession(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete<void>(`/sessions/${sessionId}`),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: meetingKeys.session(sessionId) });
      queryClient.invalidateQueries({ queryKey: meetingKeys.sessions });
      queryClient.invalidateQueries({ queryKey: meetingKeys.decisions });
    },
  });
}

/**
 * Adding to the meeting's running order — «دستور جلسه».
 *
 * Only the session query is invalidated: unlike a decision, an agenda item is
 * never read outside the meeting it belongs to, so nothing else on screen can
 * be holding a stale copy of it.
 */
export function useCreateAgenda(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAgendaInput) =>
      apiClient.post<SessionAgenda>(`/sessions/${sessionId}/agendas`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meetingKeys.session(sessionId) }),
  });
}

export function useCreateDecision(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDecisionInput) => apiClient.post<Decision>(`/sessions/${sessionId}/decisions`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meetingKeys.decisions });
      queryClient.invalidateQueries({ queryKey: meetingKeys.session(sessionId) });
    },
  });
}

/**
 * `sessionId` is only used to refresh the session screen the toggle was tapped
 * from; the endpoint itself is flat, because the مصوبات tab can toggle a
 * decision without holding its meeting.
 */
export function useUpdateDecisionStatus(sessionId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ decisionId, status }: { decisionId: string; status: DecisionStatus }) =>
      apiClient.patch<Decision>(`/decisions/${decisionId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meetingKeys.decisions });
      if (sessionId) queryClient.invalidateQueries({ queryKey: meetingKeys.session(sessionId) });
    },
  });
}
