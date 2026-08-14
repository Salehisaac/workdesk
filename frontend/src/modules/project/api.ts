import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiClient, getCollection } from '../../shared/api/client';
import { buildProjectReport } from './report';
import type { ProjectReport } from './report';
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
  UpdateProjectInput,
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
 * The project's report, folded out of the two queries the board is already
 * holding — no `/projects/:id/report` endpoint, because a report is a *view* of
 * jobs and the jobs are all in the cache. Aggregating server-side would put the
 * same numbers behind a second round trip and let the board and the report
 * disagree whenever one of them was stale; here, editing a job's status
 * invalidates `jobs` and the report re-derives on the next render for free.
 *
 * The arithmetic lives in ./report.ts — this only decides *which* jobs go in
 * (the /jobs list is flat across every project the caller can see) and keeps
 * the result memoized so scrolling the report doesn't recompute it.
 */
export function useProjectReport(projectId: string | undefined) {
  const project = useProject(projectId);
  const jobs = useJobs();

  const report = useMemo<ProjectReport | null>(() => {
    if (!project.data) return null;
    const mine = (jobs.data ?? []).filter((job) => job.projectId === projectId);
    return buildProjectReport(project.data, mine);
  }, [project.data, jobs.data, projectId]);

  return {
    report,
    project: project.data,
    // The jobs query is deliberately not part of isError: it resolves to an
    // empty list rather than throwing (see getCollection), and a project whose
    // jobs failed to load should still render its header and an empty report
    // instead of an error screen.
    isLoading: project.isLoading || jobs.isLoading,
    isError: project.isError,
  };
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

/**
 * Renaming (or re-picturing) a project touches both the list and the board, so
 * both are invalidated — a project renamed from its board must not still read
 * with its old name on «پروژه‌ها».
 */
export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) => apiClient.patch<ProjectDetail>(`/projects/${projectId}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

/**
 * Deleting a project deletes its Rasagram group with it, server-side — every
 * list is a topic in that group, and every job is in a list. Callers must warn
 * first (see ProjectEditPage): nothing about this is undoable.
 *
 * The board's own cached detail is removed rather than invalidated: refetching
 * `/projects/:id` for a project that no longer exists would only produce a 404
 * behind a screen the user is already navigating away from. `jobs` IS
 * invalidated, since the deleted project's jobs are still sitting in the flat
 * list the home calendar draws from.
 */
export function useDeleteProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete<void>(`/projects/${projectId}`),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: projectKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
      queryClient.invalidateQueries({ queryKey: projectKeys.jobs });
    },
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
