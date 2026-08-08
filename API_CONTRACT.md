# WorkDesk API Contract — v1 (Project module)

What the frontend (`frontend/`) actually calls, for the backend to implement. Ground truth for the exact
shapes is `frontend/src/modules/project/types.ts` and `frontend/src/modules/project/api.ts` — this doc
summarizes them; if they ever drift, the TypeScript is authoritative.

## JSON key casing — read this first

**All JSON keys below are camelCase**, matching the frontend's TS types exactly (`avatarUrl`, `joinSlug`,
`chatId`, `memberCount`, `topicId`, `projectId`, `createdAt`, …). The frontend does no key transformation —
whatever the backend sends is used verbatim. Goravel/GORM's default JSON marshaling of Go struct fields
is snake_case, so you'll need explicit `json:"avatarUrl"` (etc.) struct tags to match this contract, not
the default.

## Auth — every endpoint below requires this

`Authorization: Bearer <initData>`, where `<initData>` is the raw string from `Rasagram.WebApp.initData`
(plan section 5). Verify it locally (no network call):

```go
secretKey := hmac.New(sha256.New, []byte("WebAppData")).Write([]byte(botToken)).Sum(nil)
expectedHash := hmac.New(sha256.New, secretKey).Write([]byte(dataCheckString)).Sum(nil)
// dataCheckString = sorted "key=value" pairs (all initData fields except `hash`), joined by "\n"
// compare to the `hash` field in initData; reject if stale (check `auth_date`)
```

This exactly mirrors `computeHash`/`generateDataCheckString` in
`teamgram.io/bots/app/bff/minibotapps/internal/core/messages.requestWebView_handler.go` — same algorithm,
just verifying instead of signing. Extract `user_id` from the `user` JSON field inside initData; that's
the authenticated user for every request below. Recommended: a Goravel custom guard
(`facades.Auth().Extend(...)`) so controllers just call `facades.Auth(ctx).User(&user)` — see plan section 5.

No CORS setup needed anywhere: in dev, Vite's proxy (`frontend/vite.config.ts`) makes `/api/*` calls
server-to-server from the Vite dev process, so the browser only ever talks to `localhost:5173`; in prod,
Goravel serves both the API and the built frontend from the same origin (plan section 7).

## Errors

Any non-2xx response is surfaced to the user as a toast with the raw response body as text — no particular
error JSON shape is required for v1. A `{"error": "..."}` body is a reasonable default if you want one, but
the frontend doesn't parse it specially yet.

## How the project's group actually gets created

Resolved — `bridge.createGroup()` never existed and never will (confirmed absent from the real SDK), so
the **backend** creates the group itself now, server-side, via Rasagram's internal admin API
(`app/services/rasagramadmin`), not the frontend. `POST /projects` no longer takes a `chatId` in the
request at all. See that section below for the exact call sequence
(login → chat/create → chat/upgradeToSupergroup → chat/enableTopics).

---

## `GET /api/v1/projects`

List projects the authenticated user is a member of (as owner or invited member).

**Response 200** — `Project[]`:

```json
[
  {
    "id": "1",
    "name": "پروژه تست",
    "avatarUrl": null,
    "visibility": "private",
    "joinSlug": null,
    "chatId": "-1001234567890",
    "memberCount": 3,
    "onlineCount": 1,
    "createdAt": "2026-08-07T10:00:00Z"
  }
]
```

---

## `POST /api/v1/projects`

Creates a project. The authenticated user becomes the owner — **they are not included in the `members`
array below**, that array is only the *additionally invited* people from the wizard's step 3. Add the
authenticated user as a project member yourself (e.g. with a distinguishing `role`) so `GET /projects`
correctly lists projects they created.

**Request body** — `CreateProjectInput`:

```json
{
  "name": "پروژه تست",
  "avatarUrl": "https://.../avatar.png",
  "visibility": "public",
  "joinSlug": "test-project",
  "members": [
    { "id": "101", "source": "contacts", "displayName": "علی رضایی", "username": "ali", "phone": "989120000001", "online": true }
  ]
}
```

- `avatarUrl` — omitted if no avatar was picked.
- `joinSlug` — omitted when `visibility` is `"private"`. When present: English letters/digits/`-`/`_`,
  first character a letter (validated client-side already, worth re-validating server-side too).
- No `chatId` in the request — the backend creates the group itself (see below).
- `members[].source` — one of `users` | `contacts` | `groups` | `channels` | `bots` | `recentChats` | `favorites`.
  Store the whole item verbatim (`id` + `source` + denormalized display fields) as an opaque reference —
  don't try to resolve or join it against any other table (plan constraint #3 — no gRPC to teamgram-server).
  **In practice `id` needs to be a real numeric user id** — it's sent straight through to the admin API's
  `user_ids` array when creating the group, so a `source: 'contacts'` entry whose `id` isn't actually a
  platform user id would fail group creation, not just look odd in the UI.

**Backend behavior** (`ProjectController.Store`, `app/services/rasagramadmin`):

1. Resolve the authenticated user from initData.
2. Build the group's member list: the bot's own user id (parsed from `RASAGRAM_BOT_TOKEN`'s `<id>:<secret>`
   prefix) + the authenticated user's id + every `members[].id`, de-duplicated.
3. Call the internal admin API, in order:
   - `POST /x/internal/auth/login` (`{"username": ..., "password": ...}` — `RASAGRAM_ADMIN_USERNAME`/
     `RASAGRAM_ADMIN_PASSWORD`) → a token, cached and reused across requests, re-fetched once on a 401.
   - `POST /x/internal/chat/create` (`{"title": name, "user_ids": [...]}`) → `chat_id`.
   - `POST /x/internal/chat/upgradeToSupergroup` (`{"chat_id": ...}`) → `channel_id`.
   - `POST /x/internal/chat/enableTopics` (`{"channel_id": ..., "enabled": true, "tabs": false}`).
   - `channel_id` (as a string) becomes `Project.ChatId`. If any of these four calls fails, the whole
     request fails (502) — no `projects` row gets created for a group that doesn't fully exist.
4. Create the `projects` row (now including the real `chatId`).
5. Insert `project_members`: the authenticated user (as owner) + every item in `members`.

**Response 201** — `Project` (same shape as one item from `GET /projects`).

---

## `GET /api/v1/projects/:id`

**Response 200** — `ProjectDetail` (`Project` + `members` + `lists`):

```json
{
  "id": "1",
  "name": "پروژه تست",
  "avatarUrl": null,
  "visibility": "private",
  "joinSlug": null,
  "chatId": "-1001234567890",
  "memberCount": 3,
  "onlineCount": 1,
  "createdAt": "2026-08-07T10:00:00Z",
  "members": [
    { "id": "101", "source": "contacts", "displayName": "علی رضایی", "username": "ali", "phone": "989120000001", "online": true }
  ],
  "lists": [
    {
      "id": "10",
      "projectId": "1",
      "name": "کارهای این هفته",
      "topicId": "42",
      "iconColor": 7322096,
      "iconCustomEmojiId": null,
      "iconEmoji": null
    }
  ]
}
```

Return 403 or 404 (either is fine — the frontend just treats any non-2xx as an error state) if the
authenticated user isn't a member of this project.

---

## `POST /api/v1/projects/:id/lists`

**Request body:**

```json
{
  "name": "کارهای این هفته",
  "iconColor": 7322096,
  "iconCustomEmojiId": "5368324170671202286",
  "iconEmoji": "🔥"
}
```

- `iconColor` — optional. Must be one of Telegram's 6 standard forum-topic icon colors (`0x6FB9F0`/`0xFFD67E`/
  `0xCB86DB`/`0x8EEE98`/`0xFF93B2`/`0xFB6F5F` — `app/services/botapi.ForumTopicColors` on the backend,
  `FORUM_TOPIC_COLORS` in `frontend/src/modules/project/api.ts`, kept in sync by hand). Omit for the
  platform's default icon. Any other value is rejected with 422 — these are the only 6 the Bot API's own
  clients ever present, not an arbitrary RGB value.
- `iconCustomEmojiId` — optional, one of the `customEmojiId` values from `GET /topic-icons`. Sent to the Bot
  API verbatim, not validated against anything server-side (unlike `iconColor` — there's nowhere to fetch a
  known-good set to validate against at request time, see below).
- `iconEmoji` — required alongside `iconCustomEmojiId` (same request only, not otherwise). The chosen icon's
  display emoji, straight from the `GET /topic-icons` entry the user picked — stored verbatim, **not** sent to
  the Bot API. Purely so the frontend can render the icon later without re-fetching/matching `GET /topic-icons`
  every time (same denormalization pattern as `ProjectMember`'s display fields).

**Backend behavior** (`ProjectListController.Store`, `app/services/botapi`):

1. Call the Bot API's `createForumTopic` (`POST /bot<token>/createForumTopic`, `{"chat_id": project.chatId,
   "name": name, "icon_color": iconColor, "icon_custom_emoji_id": iconCustomEmojiId}` — real Telegram Bot API
   shape, confirmed by reading `teamgram.io/bots`' botway service source directly; both icon fields omitted
   entirely when not provided) against the project's `chatId`.
2. If that fails, return 502 — no `lists` row is created for a topic that doesn't exist (same all-or-nothing
   pattern as project creation).
3. Create the `lists` row (`project_id`, `name`, `icon_color`, `icon_custom_emoji_id`, `icon_emoji`, `topic_id`
   = the returned `message_thread_id`).

**Response 201:**

```json
{
  "id": "10",
  "projectId": "1",
  "name": "کارهای این هفته",
  "topicId": "42",
  "iconColor": 7322096,
  "iconCustomEmojiId": "5368324170671202286",
  "iconEmoji": "🔥"
}
```

---

## `DELETE /api/v1/projects/:id/lists/:listId`

Calls the Bot API's `deleteForumTopic` (`POST /bot<token>/deleteForumTopic`, `{"chat_id": ..., "message_thread_id":
...}`) for the list's `topicId` inside the project's `chatId`. Unlike creation, a failure here is logged but
does **not** block deleting the row — an external cleanup call failing shouldn't trap the user with a list they
can't remove.

**Response 204** — no body.

---

## `GET /api/v1/topic-icons`

Proxies the Bot API's `getForumTopicIconStickers` (`POST /bot<token>/getForumTopicIconStickers`, no params) —
purely a passthrough, needed because the bot token can never reach the frontend directly. Backs the emoji
picker in `CreateListSheet.tsx`.

**⚠️ Not usable yet**: `teamgram.io/bots`' botway service has no route for `getForumTopicIconStickers` at all,
and its `getStickerSet` route (which real Telegram's Bot API implements this method on top of) is a stub that
returns "not impl". This endpoint will 502 until one of those is actually implemented on the messenger's
platform — that's tracked as separate work outside this repo. The frontend only calls this lazily (when the
emoji picker is opened, not on every sheet mount) and degrades gracefully (shows an inline error, the rest of
list creation — name + color — still works) if it fails.

**Response 200** — `TopicIcon[]`:

```json
[
  { "customEmojiId": "5368324170671202286", "emoji": "🔥" }
]
```

---

## `POST /api/v1/uploads`

`multipart/form-data`, single field named `file`. Used for the project avatar picker (step 1 of the
create wizard calls this immediately on file selection).

**Response 200:**

```json
{ "url": "https://.../uploads/xyz.png" }
```

---

## Not in v1 (deliberately out of scope, see plan)

- Adding members to a project after creation — the admin API's `chat/create` takes an initial member list,
  but nothing confirmed yet for adding someone to an existing group after the fact. Worth checking whether
  `rasagram-new-admin` has an equivalent endpoint before assuming this needs a workaround.
- Editing/deleting a project.
- Anything about Jobs (tasks inside a List) — the frontend doesn't render or fetch these yet; `List` only
  carries `id`/`projectId`/`name`/`topicId` right now, per the plan's explicit scoping for this round.
