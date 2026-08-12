// Deep links from a Project into the Rasagram client's own chat UI.
//
// A project IS a forum-enabled supergroup and each of its lists IS a topic in
// that group (created through the Bot API's createForumTopic — see the backend's
// project_list_controller), so "open the activity for this list" needs no new
// endpoint at all: Project.chatId and ProjectListItem.topicId already carry
// everything the link needs.
import { bridge } from '../../bridge';

/**
 * Every link here is written against `t.me` even though Rasagram's real
 * deeplink host is rsog.rso-co.ir. That is not a mistake and not a leftover:
 * the SDK's openTelegramLink REJECTS any other hostname outright
 * (WebAppTgUrlInvalid) and then forwards only pathname + search to the client,
 * throwing the host away. So the host is a validator formality — what the
 * client actually receives, and resolves against Rasagram, is the path. See
 * bridge/types.ts's openTelegramLink for the read of the deployed SDK.
 */
const LINK_HOST = 'https://t.me';

/**
 * Path to one list's topic inside its project's group.
 *
 * `/c/<chat id>/<topic id>` — confirmed against a link copied out of the real
 * client (`https://rsog.rso-co.ir/c/1073741867/1185`).
 *
 * chatId goes in EXACTLY as the API returns it, with no sign flip and no
 * "-100" prefix. Worth stating plainly, because this stack uses three
 * different encodings of the same id and mixing them up has already caused a
 * live PEER_ID_INVALID (see the backend's botapi.groupChatId):
 *
 *   deep link (here)      raw positive    1073741867
 *   Rasagram Bot API      negated         -1073741867
 *   web client hash route "-100" prefix   #-1001073741867
 *
 * The raw form is the real channel id: teamgram allocates channel ids from
 * MinNebulaChatChannelID = 1073741824 (2^30) upward, which is why every one of
 * these starts just above a billion.
 */
export function topicPath(chatId: string, topicId: string): string {
  return `${LINK_HOST}/c/${chatId}/${topicId}`;
}

/** Path to a project's group itself, with no topic selected. */
export function chatPath(chatId: string): string {
  return `${LINK_HOST}/c/${chatId}`;
}

/**
 * Opens a list's topic in the client, falling back to the project's group when
 * that list has no topic yet (topicId is null until the backend's
 * createForumTopic has run for it).
 *
 * Returns false when nothing was opened — no chat id on the project, or a
 * client too old to accept the link — so the caller can say so instead of
 * leaving the tap looking like it silently did nothing.
 */
export function openProjectTopic(chatId: string | null, topicId?: string | null): boolean {
  if (!chatId) return false;
  return bridge.openTelegramLink(topicId ? topicPath(chatId, topicId) : chatPath(chatId));
}
