import type { PickedItem } from '../../bridge/types';

export type ProjectVisibility = 'private' | 'public';

export type ProjectMember = PickedItem;

export interface ProjectListItem {
  id: string;
  projectId: string;
  name: string;
  /** Forum topic id inside the project's chat — null until the backend created it. Plan section 8. */
  topicId: string | null;
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
  /** Created client-side via bridge.createGroup() before this request is sent — plan section 8. */
  chatId: string;
  members: PickedItem[];
}
