import type { PickedItem } from '../../bridge/types';

export type ProjectVisibility = 'private' | 'public';

export type ProjectMember = PickedItem;

export interface ProjectListItem {
  id: string;
  projectId: string;
  name: string;
  /** Forum topic id inside the project's chat — null until the backend created it. Plan section 8. */
  topicId: string | null;
  /** One of FORUM_TOPIC_COLORS (see api.ts), or null for the platform's default icon. */
  iconColor: number | null;
}

export interface CreateListInput {
  name: string;
  /** Omit for the platform's default icon — must be one of FORUM_TOPIC_COLORS otherwise. */
  iconColor?: number;
}

export interface Project {
  id: string;
  name: string;
  avatarUrl: string | null;
  visibility: ProjectVisibility;
  joinSlug: string | null;
  /** The project's dedicated topic-group chat id — plan section 8. */
  chatId: string | null;
  memberCount: number;
  onlineCount: number;
  createdAt: string;
}

export interface ProjectDetail extends Project {
  members: ProjectMember[];
  lists: ProjectListItem[];
}

export interface CreateProjectInput {
  name: string;
  avatarUrl?: string;
  visibility: ProjectVisibility;
  joinSlug?: string;
  members: PickedItem[];
}
