import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, getCollection } from '../../shared/api/client';
import type { CreateNoteInput, Note } from './types';

const noteKeys = {
  all: ['notes'] as const,
};

export function useNotes() {
  return useQuery({
    queryKey: noteKeys.all,
    queryFn: () => getCollection<Note>('/notes'),
    retry: false,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateNoteInput) => apiClient.post<Note>('/notes', input),
    // The home agenda is derived from this same query, so invalidating it is
    // what puts the new note on today's dashboard.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noteKeys.all }),
  });
}
