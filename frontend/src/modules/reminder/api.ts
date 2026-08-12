import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, getCollection } from '../../shared/api/client';
import type { CreateReminderInput, Reminder } from './types';

const reminderKeys = {
  all: ['reminders'] as const,
};

export function useReminders() {
  return useQuery({
    queryKey: reminderKeys.all,
    queryFn: () => getCollection<Reminder>('/reminders'),
    retry: false,
  });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReminderInput) => apiClient.post<Reminder>('/reminders', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reminderKeys.all }),
  });
}
