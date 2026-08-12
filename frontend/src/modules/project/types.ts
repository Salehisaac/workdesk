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
  /** Denormalized display copy of the chosen icon's unicode emoji — fallback while/if the animation isn't available. */
  iconEmoji: string | null;
  /** The chosen icon's file_id — feed to AnimatedTopicIcon to render it animated (GET /topic-icons/animation). */
  iconFileId: string | null;
}

export interface TopicIcon {
  customEmojiId: string;
  emoji: string;
  fileId: string;
}

export interface CreateListInput {
  name: string;
  /** Omit for the platform's default icon — must be one of FORUM_TOPIC_COLORS otherwise. */
  iconColor?: number;
  /** One of GET /topic-icons' customEmojiId values. Must be paired with iconEmoji/iconFileId. */
  iconCustomEmojiId?: string;
  /** The chosen icon's display emoji — stored verbatim, not sent to the Bot API. */
  iconEmoji?: string;
  /** The chosen icon's file_id — stored verbatim, not sent to the Bot API. */
  iconFileId?: string;
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

export type JobStatus = 'todo' | 'doing' | 'done';

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  todo: 'انجام نشده',
  doing: 'در حال انجام',
  done: 'انجام شد',
};

/**
 * A «کار» — one task inside a List, which is itself inside a Project. This is
 * the level that carries a deadline, and therefore the only part of the project
 * hierarchy that belongs on the calendar: a project spans months and isn't an
 * event, whereas a job's `dueAt` falls on exactly one day.
 *
 * Out of scope for the v1 backend (API_CONTRACT.md says so explicitly), so the
 * shape below is the frontend's side of the contract — same camelCase and
 * ISO-8601 conventions as Project. See useJobs in ./api.ts.
 */
export interface Job {
  id: string;
  title: string;
  listId: string;
  /** Denormalized so the agenda can label a job without fetching its project. */
  listName: string | null;
  projectId: string;
  projectName: string | null;
  /** ISO 8601. Null for a job with no deadline — those never reach the calendar. */
  dueAt: string | null;
  assigneeName: string | null;
  status: JobStatus;
}
