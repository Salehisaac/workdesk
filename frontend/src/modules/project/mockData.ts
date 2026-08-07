// Dev-only preview data — used when there's no real backend to talk to (see
// api.ts). Lets every screen (onboarding, list, board) be checked in a
// browser without Goravel running. Not used once a real backend exists and
// isMockBridge is false (i.e. running for real, inside the client).
import type { ProjectDetail } from './types';

export const MOCK_PROJECTS: ProjectDetail[] = [
  {
    id: 'mock-1',
    name: 'طراحی اپلیکیشن',
    avatarUrl: null,
    visibility: 'private',
    joinSlug: null,
    chatId: 'mock-chat-1',
    memberCount: 3,
    onlineCount: 1,
    createdAt: '2026-08-01T09:00:00Z',
    members: [
      { id: '101', source: 'contacts', displayName: 'علی رضایی', username: 'ali', phone: '989120000001', online: true },
      { id: '102', source: 'contacts', displayName: 'سارا محمدی', username: 'sara', online: false },
    ],
    lists: [
      { id: 'mock-list-1', projectId: 'mock-1', name: 'کارهای این هفته', topicId: 'mock-topic-1' },
      { id: 'mock-list-2', projectId: 'mock-1', name: 'در حال بررسی', topicId: 'mock-topic-2' },
    ],
  },
  {
    id: 'mock-2',
    name: 'کمپین بازاریابی',
    avatarUrl: null,
    visibility: 'public',
    joinSlug: 'marketing-campaign',
    chatId: 'mock-chat-2',
    memberCount: 1,
    onlineCount: 1,
    createdAt: '2026-08-05T09:00:00Z',
    members: [{ id: '103', source: 'users', displayName: 'رضا احمدی', username: 'reza', online: true }],
    lists: [],
  },
];
