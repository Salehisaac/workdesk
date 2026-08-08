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
  /** Sent to the Bot API's createForumTopic — opaque, sourced from GET /topic-icons. */
  iconCustomEmojiId: string | null;
  /** Denormalized display copy of the chosen icon's unicode emoji — render this, not iconCustomEmojiId. */
  iconEmoji: string | null;
}

export interface TopicIcon {
  customEmojiId: string;
  emoji: string;
}

export interface CreateListInput {
  name: string;
  /** Omit for the platform's default icon — must be one of FORUM_TOPIC_COLORS otherwise. */
  iconColor?: number;
  /** One of GET /topic-icons' customEmojiId values. Must be paired with iconEmoji. */
  iconCustomEmojiId?: string;
  /** The chosen icon's display emoji — stored verbatim, not sent to the Bot API. */
  iconEmoji?: string;
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
