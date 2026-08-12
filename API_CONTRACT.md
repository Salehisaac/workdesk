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
   If `avatarUrl` points at a file from `POST /uploads`, read its bytes off the public disk to send as the
   group's photo (step 3). A URL that isn't one of ours, or a file that can't be read, is logged and skipped —
   the group is then created without a photo rather than the request failing.
3. Call the internal admin API, in order:
   - `POST /x/internal/auth/login` (`{"username": ..., "password": ...}` — `RASAGRAM_ADMIN_USERNAME`/
     `RASAGRAM_ADMIN_PASSWORD`) → a token, cached and reused across requests, re-fetched once on a 401.
   - `POST /x/internal/chat/create` → `chat_id`. JSON (`{"title": name, "user_ids": [...]}`) when the project
     has no avatar; `multipart/form-data` when it does — `title`, `user_ids` repeated once per id, and the
     image under `file` (jpeg/png/gif) — so the group is created with its photo already set, no
     `setChatPhoto` follow-up and no bot admin rights needed.
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
      "iconEmoji": null,
      "iconFileId": null
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
  "iconEmoji": "🔥",
  "iconFileId": "v000#documents#5368324170671202286#..."
}
```

- `iconColor` — optional. Must be one of Telegram's 6 standard forum-topic icon colors (`0x6FB9F0`/`0xFFD67E`/
  `0xCB86DB`/`0x8EEE98`/`0xFF93B2`/`0xFB6F5F` — `app/services/botapi.ForumTopicColors` on the backend). Omit
  for the platform's default icon. Any other value is rejected with 422. **Not currently sent by the
  frontend** — `CreateListSheet.tsx` dropped the color picker in favor of the emoji-only picker below, but the
  backend still accepts/validates it if ever wired back up.
- `iconCustomEmojiId` — optional, one of the `customEmojiId` values from `GET /topic-icons`. Sent to the Bot
  API verbatim, not validated against anything server-side (unlike `iconColor` — there's nowhere to fetch a
  known-good set to validate against at request time).
- `iconEmoji` / `iconFileId` — required alongside `iconCustomEmojiId` (same request only, not otherwise). The
  chosen icon's display emoji and file id, straight from the `GET /topic-icons` entry the user picked — stored
  verbatim, **not** sent to the Bot API. Purely so the frontend can render the icon (animated, via
  `GET /topic-icons/animation`, falling back to the plain `iconEmoji` glyph) later without re-fetching/matching
  `GET /topic-icons` every time (same denormalization pattern as `ProjectMember`'s display fields).

**Backend behavior** (`ProjectListController.Store`, `app/services/botapi`):

1. Call the Bot API's `createForumTopic` (`POST /bot<token>/createForumTopic`, `{"chat_id": project.chatId,
   "name": name, "icon_color": iconColor, "icon_custom_emoji_id": iconCustomEmojiId}` — real Telegram Bot API
   shape, confirmed by reading `teamgram.io/bots`' botway service source directly; both icon fields omitted
   entirely when not provided) against the project's `chatId`.
2. If that fails, return 502 — no `lists` row is created for a topic that doesn't exist (same all-or-nothing
   pattern as project creation).
3. Create the `lists` row (`project_id`, `name`, `icon_color`, `icon_custom_emoji_id`, `icon_emoji`,
   `icon_file_id`, `topic_id` = the returned `message_thread_id`).

**Response 201:**

```json
{
  "id": "10",
  "projectId": "1",
  "name": "کارهای این هفته",
  "topicId": "42",
  "iconColor": 7322096,
  "iconCustomEmojiId": "5368324170671202286",
  "iconEmoji": "🔥",
  "iconFileId": "v000#documents#5368324170671202286#..."
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

## `GET /api/v1/projects/:id/tags` and `POST /api/v1/projects/:id/tags`

Tags are scoped to the **project**, not to the job or list that first used one — define a tag while creating a
job in one list and every job in every other list of that project can pick it up afterwards. That's why this
lives at the project level and not inside the job payload.

**Response 200 / 201** — `JobTag` / `JobTag[]`:

```json
{ "id": "7", "projectId": "3", "name": "فوری", "color": "#b45309" }
```

- `color` — nullable; when null the frontend derives a stable colour from the name, so a tag is never colourless.
- `POST` body is `{ "name": string, "color"?: string }`. Names are unique per project, and re-posting an
  existing name returns that tag with **200** instead of failing — from the tag sheet's point of view "create
  this tag" and "give me this tag" are the same intent.

---

## `GET /api/v1/jobs`

Every Job across every project the caller is a member of. Deliberately **flat**, not nested under a list: the
home calendar draws a month of deadline indicators across all projects at once, which through the hierarchy
would be a request per list.

**Response 200** — `Job[]`:

```json
[
  {
    "id": "12", "number": 2, "title": "تحویل طرح نهایی", "description": null,
    "listId": "4", "listName": "list1", "projectId": "3", "projectName": "بازطراحی اپلیکیشن",
    "dueAt": "2026-10-03T03:00:00Z", "status": "inProgress",
    "assignees": [ { "id": "101", "source": "users", "displayName": "…", "username": null, "phone": null, "online": true } ],
    "tags": [ { "id": "7", "projectId": "3", "name": "فوری", "color": "#b45309" } ],
    "checklist": [ { "id": "1", "text": "جمع‌آوری بازخوردها", "done": false } ],
    "createdAt": "2026-08-12T09:00:00Z"
  }
]
```

- `dueAt` — nullable. A job without a deadline belongs to no calendar day and never appears on the calendar.
  It's the **only** date in the Project → List → Job hierarchy: a project spans months and isn't an event.
- `status` — one of `notStarted`, `inProgress`, `paused`, `canceled`, `done`, `rejected`.
- `assignees` — resolved against `project_members` at read time, so a member renamed there doesn't leave stale
  name copies on every job they're on. The rows themselves store only the opaque `ref_id`.

---

## `POST /api/v1/projects/:id/jobs`

**Request:**

```json
{
  "listId": "4", "title": "تحویل طرح نهایی", "description": "…",
  "assigneeIds": ["101"], "tagIds": ["7"],
  "dueAt": "2026-10-03T03:00:00.000Z",
  "checklist": [{ "text": "جمع‌آوری بازخوردها" }],
  "status": "inProgress"
}
```

- `listId` must belong to this project, every `assigneeIds` entry must be a member of it, and every `tagIds`
  entry must be one of its tags — otherwise **422**. Without those checks a member of project A could file a
  job into project B's list by id.
- `number` is assigned server-side as the project's next sequence value (shown as «#۲»).
- `dueAt` is any ISO 8601 timestamp; the frontend builds it from a local Jalali day plus a chosen time, so the
  instant round-trips back to the day the user tapped.

**Response 201** — the created `Job`.

> The table is `project_jobs`, not `jobs` — Goravel's queue already owns `jobs`.

---

## `GET /api/v1/topic-icons`

Proxies the Bot API's `getForumTopicIconStickers` (`POST /bot<token>/getForumTopicIconStickers`, no params) —
purely a passthrough, needed because the bot token can never reach the frontend directly. Backs the emoji
picker in `CreateListSheet.tsx`. Confirmed live and working (112 icons as of this writing) — this platform's
`getForumTopicIconStickers`/`getStickerSet` gap (originally not implemented — see git history) has since been
fixed server-side.

**Response 200** — `TopicIcon[]`:

```json
[
  { "customEmojiId": "5312536423851630001", "emoji": "💡", "fileId": "v000#documents#5312536423851630001#..." }
]
```

- `fileId` — feed this to `GET /topic-icons/animation` to render the icon animated (`AnimatedTopicIcon.tsx`).

---

## `GET /api/v1/topic-icons/animation?fileId=...`

Resolves `fileId` via the Bot API's `getFile`, downloads the file from its file-serving route (`GET
/file/bot<token>/<file_path>` — same convention as real Telegram), and decompresses it server-side (these are
gzip-compressed Lottie JSON, `.tgs`, confirmed against a real sticker from this platform) before returning it,
so the frontend can feed the response straight into a Lottie player (`lottie-web`) with no gunzip step of its
own.

Returned with `Cache-Control: public, max-age=604800, immutable` — a given `fileId`'s content never changes,
safe to cache hard on both ends. `AnimatedTopicIcon.tsx` only calls this once its container is actually
scrolled into view (the picker grid has 100+ icons; animating all of them at once on open would be a real
performance hit on low/mid-end Android WebViews).

**Response 200** — raw Lottie animation JSON (`Content-Type: application/json`), shape defined by the `.tgs`
file itself, not by this contract.

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
- Editing/deleting a Job, or toggling a checklist item — Jobs can be created and listed (see above), but every
  mutation after creation is still out of scope.
- Job activity/history («فعالیت‌ها»).
