import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../shared/api/client';
import type { CreateListInput, CreateProjectInput, Project, ProjectDetail, ProjectListItem, TopicIcon } from './types';

// Telegram's 6 standard forum-topic icon colors — the exact preset dots real
// Telegram clients offer when creating a topic (the protocol technically
// accepts arbitrary RGB ints, but these are the only values any client
// actually presents, mirrored 1:1 from app/services/botapi.ForumTopicColors
// on the backend, which validates against this same set).
export const FORUM_TOPIC_COLORS: { value: number; label: string }[] = [
  { value: 0x6fb9f0, label: 'آبی' },
  { value: 0xffd67e, label: 'زرد' },
  { value: 0xcb86db, label: 'بنفش' },
  { value: 0x8eee98, label: 'سبز' },
  { value: 0xff93b2, label: 'صورتی' },
  { value: 0xfb6f5f, label: 'قرمز' },
];

const projectKeys = {
  all: ['projects'] as const,
  detail: (id: string) => ['projects', id] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: () => apiClient.get<Project[]>('/projects'),
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(projectId ?? ''),
    queryFn: () => apiClient.get<ProjectDetail>(`/projects/${projectId}`),
    enabled: !!projectId,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => apiClient.post<Project>('/projects', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export function useCreateList(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateListInput) => apiClient.post<ProjectListItem>(`/projects/${projectId}/lists`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
  });
}

export function useDeleteList(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) => apiClient.delete<void>(`/projects/${projectId}/lists/${listId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
  });
}

export function useUploadAvatar() {
  return useMutation({
    mutationFn: (file: File) => apiClient.upload<{ url: string }>('/uploads', file),
  });
}

// GET /topic-icons proxies the Bot API's getForumTopicIconStickers (the bot
// token can't reach the client). Disabled by default and only fetched on
// demand (see CreateListSheet) — as of this writing the backend route this
// proxies doesn't exist on the messenger's platform yet, so this 502s until
// that lands; no reason to fire it on every sheet mount.
export function useTopicIcons(enabled: boolean) {
  return useQuery({
    queryKey: ['topic-icons'],
    queryFn: () => apiClient.get<TopicIcon[]>('/topic-icons'),
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}
