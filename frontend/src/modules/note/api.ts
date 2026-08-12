import { useQuery } from '@tanstack/react-query';
import { getCollection } from '../../shared/api/client';
import type { Note } from './types';

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
