import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isMockBridge } from '../../bridge';
import { apiClient } from '../../shared/api/client';
import { MOCK_PROJECTS } from './mockData';
import type { CreateProjectInput, Project, ProjectDetail, ProjectListItem } from './types';

const projectKeys = {
  all: ['projects'] as const,
  detail: (id: string) => ['projects', id] as const,
};

// No backend to talk to yet outside the real client (isMockBridge — see
// bridge/index.ts): read endpoints resolve from local fixture data instead of
// a real fetch, so every screen (onboarding/list/board) can be checked in a
// browser without Goravel running. Add ?mockProjects=1 to the URL to preview
// the "has projects" list/board states instead of the empty/onboarding one.
// Mutations (create project/list, delete list, upload) are NOT mocked — they
// need a real backend, per API_CONTRACT.md.
function wantsMockProjects(): boolean {
  return isMockBridge && new URLSearchParams(window.location.search).get('mockProjects') === '1';
}

function toProjectSummary(detail: ProjectDetail): Project {
  const { members: _members, lists: _lists, ...summary } = detail;
  return summary;
}

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: async () => {
      if (isMockBridge) return wantsMockProjects() ? MOCK_PROJECTS.map(toProjectSummary) : [];
      return apiClient.get<Project[]>('/projects');
    },
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(projectId ?? ''),
    queryFn: async () => {
      if (isMockBridge) {
        const found = MOCK_PROJECTS.find((project) => project.id === projectId);
        if (found) return found;
        throw new Error('پروژه یافت نشد (mock)');
      }
      return apiClient.get<ProjectDetail>(`/projects/${projectId}`);
    },
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
    mutationFn: (name: string) => apiClient.post<ProjectListItem>(`/projects/${projectId}/lists`, { name }),
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
