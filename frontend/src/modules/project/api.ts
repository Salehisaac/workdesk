import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, getCollection } from '../../shared/api/client';
import type {
  CreateJobInput,
  CreateJobTagInput,
  CreateListInput,
  CreateProjectInput,
  Job,
  JobTag,
  Project,
  ProjectDetail,
  ProjectListItem,
  TopicIcon,
  UpdateJobInput,
} from './types';

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
  jobs: ['jobs'] as const,
  tags: (projectId: string) => ['projects', projectId, 'tags'] as const,
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

/**
 * Every job the user can see, across all their projects and lists.
 *
 * Flat rather than nested under `/projects/:id/lists/:listId/jobs` (how a job is
 * *written*) because the home calendar needs deadlines across every project at
 * once to draw a month of indicator dots — walking the hierarchy would be a
 * request per list. Not implemented on the backend yet, so this resolves to an
 * empty list until it is; see getCollection.
 */
export function useJobs() {
  return useQuery({
    queryKey: projectKeys.jobs,
    queryFn: () => getCollection<Job>('/jobs'),
    retry: false,
  });
}

/**
 * Creating a job invalidates the flat job list, which is what the home
 * calendar's deadline dots are drawn from — so a job created here shows up on
 * the calendar without a reload.
 */
export function useCreateJob(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJobInput) => apiClient.post<Job>(`/projects/${projectId}/jobs`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.jobs });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

/**
 * Editing a job invalidates the same two queries creating one does: the flat
 * job list (which is both the board's source and the home calendar's deadline
 * dots) and the project detail. A retitled or rescheduled job therefore
 * updates everywhere it appears, not just on the board it was edited from.
 */
export function useUpdateJob(projectId: string, jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateJobInput) => apiClient.patch<Job>(`/projects/${projectId}/jobs/${jobId}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.jobs });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

/**
 * Tags are project-scoped, so this is the pool every list's jobs choose from —
 * see JobTag. Fetched on demand (the tag sheet has to be opened first).
 */
export function useProjectTags(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: projectKeys.tags(projectId),
    queryFn: () => getCollection<JobTag>(`/projects/${projectId}/tags`),
    enabled: enabled && !!projectId,
    retry: false,
  });
}

export function useCreateProjectTag(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJobTagInput) => apiClient.post<JobTag>(`/projects/${projectId}/tags`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.tags(projectId) }),
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
// demand (see CreateListSheet), not on every sheet mount.
export function useTopicIcons(enabled: boolean) {
  return useQuery({
    queryKey: ['topic-icons'],
    queryFn: () => apiClient.get<TopicIcon[]>('/topic-icons'),
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}

// GET /topic-icons/animation proxies getFile + the Bot API's file-serving
// route, decompressed server-side into raw Lottie JSON — see
// AnimatedTopicIcon. `enabled` is gated on the icon actually being
// scrolled into view (see there) — with 100+ icons in the picker, fetching
// every animation up front would be wasteful and slow on low-end devices.
export function useTopicIconAnimation(fileId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['topic-icon-animation', fileId],
    queryFn: () => apiClient.get<object>(`/topic-icons/animation?fileId=${encodeURIComponent(fileId)}`),
    enabled: enabled && !!fileId,
    staleTime: Infinity,
    retry: false,
  });
}
