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
  /**
   * The member who created it — the only one the API lets edit or delete it.
   * Compare against `useMe()`'s id to decide whether to *offer* either; the
   * backend enforces it regardless (403), so this only ever hides a dead end.
   */
  ownerRefId: string;
  memberCount: number;
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

/**
 * PATCH body — every field optional, only the ones present are changed (the same
 * shape UpdateJobInput has). `avatarUrl: ''` clears the picture; `undefined`
 * leaves it alone.
 *
 * No `members`: a project's people are its Rasagram group's members, and that
 * group is where they're added or removed — not here.
 *
 * Renaming changes the project inside WorkDesk only. The group keeps the title
 * and photo it was created with: the platform's Bot API has no working
 * setChatTitle/setChatPhoto (both are stubs) and the admin API has no rename at
 * all, so there is nothing to propagate to yet.
 */
export interface UpdateProjectInput {
  name?: string;
  avatarUrl?: string;
  visibility?: ProjectVisibility;
  joinSlug?: string;
}

/** The six states a job moves through — the set the status sheet offers. */
export type JobStatus = 'notStarted' | 'inProgress' | 'paused' | 'canceled' | 'done' | 'rejected';

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  notStarted: 'آغاز نشده',
  inProgress: 'در حال انجام',
  paused: 'متوقف شده',
  canceled: 'لغو شده',
  done: 'انجام شده',
  rejected: 'رد شده',
};

/** Every job starts here; the rest are reachable from the status sheet. */
export const DEFAULT_JOB_STATUS: JobStatus = 'notStarted';

/** Order the status sheet lists them in — the natural progression, then the exits. */
export const JOB_STATUSES: JobStatus[] = ['notStarted', 'inProgress', 'paused', 'canceled', 'done', 'rejected'];

/**
 * A tag belongs to the *project*, not to the job that first used it — define one
 * on any job and every list in that project can pick it up afterwards. That's
 * why creating a tag is a project-level mutation (see useCreateProjectTag) and
 * not something embedded in the job payload.
 */
export interface JobTag {
  id: string;
  projectId: string;
  name: string;
  /** Any CSS colour, or null to let the UI pick a stable one from the name. */
  color: string | null;
}

export interface JobChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

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
  /** Per-project sequence number, shown as «#۲». Null until the backend assigns one. */
  number: number | null;
  title: string;
  description: string | null;
  listId: string;
  /** Denormalized so the agenda can label a job without fetching its project. */
  listName: string | null;
  projectId: string;
  projectName: string | null;
  /** ISO 8601. Null for a job with no deadline — those never reach the calendar. */
  dueAt: string | null;
  /** Project members the job is assigned to — same shape the member picker returns. */
  assignees: ProjectMember[];
  tags: JobTag[];
  checklist: JobChecklistItem[];
  status: JobStatus;
  createdAt: string;
}

export interface CreateJobInput {
  /** Which list the job lands in — changeable from the form's list selector. */
  listId: string;
  title: string;
  description?: string;
  /** ProjectMember ids, not the whole objects; the backend already has the members. */
  assigneeIds: string[];
  tagIds: string[];
  /** ISO 8601 with a meaningful time-of-day, or omitted for no deadline. */
  dueAt?: string;
  /** Ordered; ids are assigned server-side, so only the text goes up. */
  checklist: { text: string }[];
  status: JobStatus;
}

/**
 * PATCH body — every field optional, and only the ones present are changed.
 * The edit form happens to send all of them, but the endpoint is partial on
 * purpose so a single field can be flipped from elsewhere later without
 * resending (and risking clobbering) the rest.
 *
 * Present-but-empty is a real value and clears things: `dueAt: ''` drops the
 * deadline, `assigneeIds: []` removes every assignee. `undefined` is what
 * leaves a field alone — never send null.
 *
 * checklist items carry `done` here, unlike CreateJobInput: a job being edited
 * has existing items whose checked state has to survive the round trip (and be
 * togglable), whereas a brand new one has nothing checked yet.
 */
export interface UpdateJobInput {
  listId?: string;
  title?: string;
  description?: string;
  assigneeIds?: string[];
  tagIds?: string[];
  dueAt?: string;
  checklist?: { text: string; done: boolean }[];
  status?: JobStatus;
}

export interface CreateJobTagInput {
  name: string;
  color?: string;
}
