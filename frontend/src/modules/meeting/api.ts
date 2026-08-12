import { useQuery } from '@tanstack/react-query';
import { getCollection } from '../../shared/api/client';
import type { Decision, Session } from './types';

// Both collections are fetched whole and filtered by day on the client, exactly
// like useProjects() does — the dashboard needs day markers across the whole
// visible month, not just the selected day, so a per-day endpoint would mean a
// request per cell. If these ever grow past a few hundred rows the query key is
// already shaped to take a date range without touching callers.
const meetingKeys = {
  sessions: ['sessions'] as const,
  decisions: ['decisions'] as const,
};

export function useSessions() {
  return useQuery({
    queryKey: meetingKeys.sessions,
    queryFn: () => getCollection<Session>('/sessions'),
    retry: false,
  });
}

export function useDecisions() {
  return useQuery({
    queryKey: meetingKeys.decisions,
    queryFn: () => getCollection<Decision>('/decisions'),
    retry: false,
  });
}
