# WorkDesk API Contract

What the frontend (`frontend/`) actually calls. Ground truth for the exact shapes is each module's
`types.ts`/`api.ts` under `frontend/src/modules/` — this doc summarizes them; if they ever drift, the
TypeScript is authoritative.

Covered here: **Project** (projects, lists, tags, jobs), **Note**, **Reminder**, **Meeting repository**
(sessions, their agendas and decisions — see the «مخزن جلسه» section near the end) and **Ledger**
(books and their transactions — the «دفتر مالی» section after it).

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

## Who may do what inside a project

| Action | Who |
| ------ | --- |
| Create a list, file a job | **any member** — a project is a shared board, and gating this would make it one person's |
| Edit or delete a job | the job's **creator** (`createdBy`), or the **project's creator** (`ownerRefId`) |
| Delete a list | the list's **creator** (`createdBy`), or the **project's creator** |
| Edit or delete the project, add a member | the **project's creator** alone |

Enforced server-side on every write (`canManage` in `app/http/controllers/project_controller.go`); anything
else is **403**. `createdBy` and `ownerRefId` are on the wire so the app can avoid offering what would be
refused — the board hides a list's ⋮ and declines to open a job's edit screen — but that is a courtesy, not
the check.

`createdBy` is `""` on rows written before the column existed (lists gained it in
`20260814000002_add_created_by_to_lists_table`; jobs always had it). An empty string matches no caller, so
those rows fall to the project's creator alone — the safe direction for a permission to fail in.

There is no list *edit* endpoint. Nothing in the app renames a list, and a rename couldn't reach its topic
anyway (botway's `editForumTopic` is a stub — see below), so the rule above covers deletion only.

## Group announcements

A project IS a group and each of its lists IS a topic in it, so creating any of the three levels also says so
in the chat (`app/services/projectfeed`, one Bot API `sendMessage` per create):

| Created | Posted into | Link it carries |
| ------- | ----------- | --------------- |
| Project | the group's **General topic** (`sendMessage` with no `message_thread_id`) | `?startapp=project-<id>` → `/projects/:projectId` |
| List | the **topic just created for it** (`message_thread_id` = the list's `topicId`) | `?startapp=list-<projectId>-<listId>` → `/projects/:projectId?list=:listId` |
| Job | the **topic of the list it was filed into** | `?startapp=job-<projectId>-<jobId>` → `/projects/:projectId/jobs/:jobId` |

- The link is `RASAGRAM_MINIAPP_URL` + `?startapp=<param>` — the same mechanism session/ledger invites use
  (`app/services/invite`). The frontend's `startParamRoute()` (`app/router.tsx`) is the other half of the
  contract; every `<id>` segment must be digits or it lands on the home page instead.
- With `RASAGRAM_MINIAPP_URL` unset the message is still posted, just without the link.
- **Nothing here can fail a request.** A send that errors (bot not in the group, topic deleted, Bot API down)
  is logged and the 201 goes out regardless — the row already exists, and refusing it would throw away
  something the user made. Note the cost of the extra call: these run inline, so a hanging Bot API adds up
  to its 15s timeout to a create request.
- `chat_id` is the project's `chatId` **negated** (`-<chatId>`) — this platform reads a positive id as a
  private chat. Same conversion `createForumTopic` uses (`botapi.groupChatId`), and the reason
  `botapi.SendGroupMessage` is separate from `SendMessage` (which sends DMs and must not negate).

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
    "ownerRefId": "101",
    "memberCount": 3,
    "createdAt": "2026-08-07T10:00:00Z"
  }
]
```

- `ownerRefId` — the `ref_id` of the member stamped `role: "owner"` (the creator). The only identity
  `PATCH`/`DELETE /projects/:id` accept; on the wire so the frontend can hide an edit button that would only
  answer 403. `""` for a legacy row with no owner-stamped member, which reads as "nobody may edit this".
- There is deliberately **no online count**. There used to be one, derived from each member's `online` flag,
  but that flag is a snapshot captured when the member was *picked* — it never tracked who was actually
  online, it just aged. The UI shows the member count alone rather than a number that looks live and isn't.
  (`members[].online` is still carried through as part of the picked item stored verbatim.)

---

## `POST /api/v1/projects`

Creates a project. The authenticated user becomes the owner — **they are not included in the `members`
array below**, that array is only the *additionally invited* people from the wizard's members step. Add the
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
- `visibility` / `joinSlug` — **the wizard no longer asks.** The private/public step was removed, so the app
  now always sends `"visibility": "private"` and never a `joinSlug`; the example above shows the other
  branch only because the endpoint still accepts it. Nothing server-side changed to drop the question — the
  one caller simply stopped asking it, which leaves public projects available if the UI ever wants them back.
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
2. Build the group's member list, **in this order**: the authenticated user's id, then the bot's own user id
   (parsed from `RASAGRAM_BOT_TOKEN`'s `<id>:<secret>` prefix), then every `members[].id`, de-duplicated.
   The order is not cosmetic — `chat/create` makes `user_ids[0]` the group's **owner**, so the person creating
   the project has to come first; the bot only needs to be a member to run the topic lifecycle.
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
6. Announce the project in the group's **General topic** (`app/services/projectfeed`) — the project's name
   plus a link that opens it in the mini app (`RASAGRAM_MINIAPP_URL?startapp=project-<id>`). Best-effort:
   a failed send is logged and the 201 still goes out (see “Group announcements” below).

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
  "ownerRefId": "101",
  "memberCount": 3,
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

## `POST /api/v1/projects/:id/members`

Adds people to a project — **the creator only** (403 otherwise).

```json
{ "members": [{ "id": "101", "source": "contacts", "displayName": "علی رضایی", "username": "ali", "phone": null, "online": true }] }
```

**Backend behavior** (`ProjectController.StoreMembers`):

1. Ids already in the project are **dropped, not rejected** — a picker that returned an existing member is a
   duplicate, and failing the batch over it would make adding two people fail because one was already there.
   Every remaining id must parse as a numeric user id (422 otherwise), since it is about to be sent to the
   admin API. Nobody new → **200** with the project unchanged.
2. `POST /x/internal/channel/addParticipants` (`{"channel_id": <project.chatId>, "user_ids": [...]}`) — the
   whole batch in one RPC, invoked as the channel's creator server-side (one more reason `user_ids[0]` at
   creation must be the person creating the project).
3. Only then the `project_members` rows. **The group comes first and a failure there is fatal (502, nothing
   written)**: the group *is* the membership — every list is a topic in it — so a row for someone who isn't in
   the group would name a person who can't see any of the work it is about.

**Response 201** — the full `ProjectDetail`.

> Removing a member is not offered, here or in the app: taking someone out of a Rasagram group is done in the
> messenger, and doing it quietly behind their back is not this app's to do.

---

## `PATCH /api/v1/projects/:id`

Edits a project's identity. **Creator only** — the caller must be the member stamped `role: "owner"`
(`ownerRefId` above); anyone else gets 403, a non-member gets the same 403 as for `GET`.

**Request body** — `UpdateProjectInput`, PATCH-shaped: every field optional, only the ones **present** are
changed (same convention as `PATCH .../jobs/:jobId`).

```json
{ "name": "پروژه تست", "avatarUrl": "/storage/uploads/abc.png" }
```

- `name` — present-but-blank is **422**, not a way to clear it.
- `avatarUrl` — `""` clears the picture. The app's own screen never sends that: clearing the photo there
  repaints a monogram and uploads it, so a project always has one.
- `visibility` / `joinSlug` — accepted for parity with `POST`; the app doesn't send them. Setting
  `visibility: "private"` drops any `joinSlug`, whichever order the two arrive in.
- **No `members`.** A project's people are its Rasagram group's members, and that group is where they're
  added or removed.

**This changes WorkDesk's record only — the Rasagram group keeps the title and photo it was created with.**
Not an oversight: botway's `setChatTitle` and `setChatPhoto` handlers are both stubs returning "not impl"
(read directly, like every other claim about this platform in `app/services/botapi`), and the admin API has
no rename route at all. A renamed project therefore keeps the old name on its group until one of those exists.

**Response 200** — `ProjectDetail`, the same shape `GET /projects/:id` returns.

---

## `DELETE /api/v1/projects/:id`

Deletes a project **and its Rasagram group**. Creator only, same check as `PATCH`. There is no undo on
either side, so the frontend warns explicitly before calling this (`ProjectEditPage` — the dialog names what
goes: the group, its topics, the lists, the jobs, and the conversations in them, for every member).

**Backend behavior** (`ProjectController.Destroy`):

1. The group first — `POST /x/internal/channel/delete` (`{"channel_id": <project.chatId as a number>}`) via
   the internal admin API. Raw and positive: this is the admin API, which speaks the platform's own ids, not
   the Bot API's negated convention. The platform invokes it as the channel's **creator** and rejects anyone
   else, which is why `user_ids[0]` at creation has to be the person creating the project.
   **A failure here is logged, not fatal** — same stance list deletion takes.
2. Then the `projects` row. Everything the project owns goes with it through the schema's own foreign keys:
   `project_members`, `lists`, `project_jobs` and the job pivots are `ON DELETE CASCADE`; `sessions` and
   `notes` filed under the project are `ON DELETE SET NULL`, so a meeting or a note survives and simply
   stops naming a project that no longer exists.

The order is deliberate and not interchangeable. Group-then-row is recoverable — if the row delete fails, the
user deletes again, the second group delete logs a failure for something already gone, and the row goes.
Row-then-group isn't: once the row is gone nothing remembers the `chatId`, and the group would outlive its
project with no way back to it.

**Response 204** — no body.

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
4. Post the topic's first message into that new topic (`app/services/projectfeed`) — the list's name plus a
   link back into the app (`?startapp=list-<projectId>-<listId>`, which opens the board scrolled to this
   list). Best-effort, like every announcement (see “Group announcements” below).

**Response 201:**

```json
{
  "id": "10",
  "projectId": "1",
  "name": "کارهای این هفته",
  "createdBy": "101",
  "topicId": "42",
  "iconColor": 7322096,
  "iconCustomEmojiId": "5368324170671202286",
  "iconEmoji": "🔥",
  "iconFileId": "v000#documents#5368324170671202286#..."
}
```

---

## `DELETE /api/v1/projects/:id/lists/:listId`

The list's creator or the project's (see “Who may do what” above); anyone else gets **403**.

The list's topic is **closed, not deleted** — `POST /bot<token>/closeForumTopic`, `{"chat_id": ...,
"message_thread_id": ...}`. A list stops existing in the app; the conversation held in its topic stays in the
group, readable and locked. Deleting the topic would take those messages with it, which is not what removing a
list from a board should mean. Unlike creation, a failure here is logged but does **not** block deleting the
row — an external cleanup call failing shouldn't trap the user with a list they can't remove.

> **Expect that call to fail today.** `closeForumTopic` is not implemented on this platform: botway's handler
> logs `not impl` and returns `ErrMethodNotImpl` — as do `deleteForumTopic` (what this used to call, equally
> in vain) and `editForumTopic`. Only `createForumTopic` is real. Until one of them is implemented in botway
> — or an equivalent is added to the internal admin API, which today has no topic routes at all
> (`chat/enableTopics` is the only topic-adjacent one) — a deleted list leaves its topic open in the group.
> The row still goes, and the cost is a stale topic, not a stuck list.

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
    "createdBy": "101",
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

After the job is written it is announced in **its list's topic** (`app/services/projectfeed`): «#۲» + title,
the deadline in Jalali (Asia/Tehran), the assignees' display names, and a link that opens the job in the app
(`?startapp=job-<projectId>-<jobId>`). Best-effort — see “Group announcements” below.

> The table is `project_jobs`, not `jobs` — Goravel's queue already owns `jobs`.

---

## `PATCH /api/v1/projects/:id/jobs/:jobId`

Edits one job — **the job's creator or the project's creator only** (403 otherwise). Backs the edit screen you
reach by tapping a card on the board (`/projects/:projectId/jobs/:jobId/edit`), which the board only opens for
those two.

Project-scoped rather than a flat `/jobs/:id` so the caller's membership is checked against the same project
the job must belong to, in one step — the same shape every other write here has. A `jobId` from another
project reads as **404**, not 403: it does not exist as far as this caller is concerned.

**Request** — every field optional; only the ones **present** are changed:

```json
{
  "listId": "4", "title": "تحویل طرح نهایی", "description": "…",
  "assigneeIds": ["101"], "tagIds": ["7"],
  "dueAt": "2026-10-03T03:00:00.000Z",
  "checklist": [{ "text": "جمع‌آوری بازخوردها", "done": true }],
  "status": "done"
}
```

- **Present-but-empty clears; omitted leaves alone.** `"dueAt": ""` drops the deadline, `"assigneeIds": []`
  removes every assignee, `"description": ""` clears the description. A JSON `null` reads the same as omitted
  (it unmarshals a pointer back to nil), so use the empty value to clear — never null.
- Partial on purpose even though the edit form sends everything: it lets a single field be flipped from
  elsewhere later — a status from the board, a checklist item from a card — without resending, and risking
  clobbering, the rest.
- `checklist` items carry `done` here, unlike on create where nothing is ticked off yet. The collection is
  **replaced wholesale**, so item ids change on every save; nothing refers to them across a request.
- Same ownership rules as `POST` — `listId`, `assigneeIds` and `tagIds` must all belong to this project,
  otherwise **422**. Everything is validated before anything is written, so a request that fails validation
  leaves the job exactly as it was.
- `number` and `createdBy` are **not** editable: the first is a per-project sequence the backend owns, the
  second records who filed the job — and now also decides who may edit it, one more reason a request must not
  be able to rewrite it.

**Response 200** — the updated `Job`.

---

## `DELETE /api/v1/projects/:id/jobs/:jobId`

Deletes one job. Same permission as editing it: the job's creator or the project's creator, **403** otherwise.
The job's assignees, tags and checklist items go with it through the schema's own `ON DELETE CASCADE`.

Nothing is posted in the project's group about it — a job announces itself when it is filed because that is
news, and the announcement of a job that no longer exists stays put either way (the app can't unsend it).

**Response 204** — no body.

---

## `GET /api/v1/notes` and `POST /api/v1/notes`

Notes are personal, like reminders: no project owns them, and the caller only ever sees their own. `GET`
returns every one of the caller's notes, newest first — flat rather than per-day, for the same reason
`GET /jobs` is flat.

**Response 200** — `Note[]`:

```json
[
  {
    "id": "5", "title": "جمع‌بندی تماس با کارفرما",
    "excerpt": "قرار شد نسخه‌ی اول تا آخر هفته تحویل شود…",
    "projectId": "3", "projectName": "بازطراحی اپلیکیشن",
    "createdAt": "2026-08-13T18:10:00Z"
  }
]
```

- `excerpt` — the body flattened to one line and cut at 120 **characters** (the card never renders the whole
  note). Null when the note has no body.
- `createdAt` **is** the note's day. There is no separate date field, because there is no way to write a note
  for any day but the one you're on — see below.

**Request** (`POST`):

```json
{ "title": "جمع‌بندی تماس با کارفرما", "body": "…", "projectId": "3", "date": "2026-08-13T21:40:00+03:30" }
```

- **`date` must be today, or 422** (`a note can only be created for the current day`). It's compared in the
  offset the client sent, not a server zone — a calendar day is whatever the writer's own wall clock calls
  it, and comparing Gregorian y/m/d is the same test as comparing the Jalali day they see, since both roll
  over at the same local midnight. Omitting `date` is allowed and means "no claim about the day".
- Nothing is ever backdated regardless: `date` is checked and thrown away, and the stored day is `created_at`
  from the insert. The check exists so a client whose clock has drifted, or a form left open past midnight,
  is *told* rather than having its note filed under a day the user wasn't looking at.
- `body` and `projectId` are optional. A `projectId` the caller isn't a member of is **422** — it's a field of
  the note, not the resource being addressed, so it doesn't read as 403.
- Notes are create-only in v1: no edit, no delete, and no screen of their own. A note shows up on its day in
  the home dashboard's «یادداشت‌ها» section and nowhere else.

**Response 201** — the created `Note`.

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

## Meeting repository — «مخزن جلسه»

The second module that reaches people directly instead of posting into a group. Ground truth for the shapes
is `frontend/src/modules/meeting/types.ts`.

**How a session differs from a project, and why that's the whole module.** Creating a project provisions a
Rasagram supergroup, and the group appearing in everyone's chat list *is* the invitation. A session
provisions nothing — no `chatId`, no group, no topics. Instead `POST /sessions` messages each picked member
directly, from the bot, with a link that opens the mini app on that session:

```
<services.rasagram.miniapp_url>?startapp=session-<id>
```

`RASAGRAM_MINIAPP_URL` is the app's own deep link as the Rasagram client resolves it (e.g.
`https://rsog.rso-co.ir/<bot username>/<app short name>`). Note this is *not* the `t.me` formality
`modules/project/links.ts` observes — that constraint comes from the SDK's `openTelegramLink` validator,
which only ever sees links built inside the webview. This one travels the other way, as text in a chat
message, so it must be an address the client can actually resolve. Leave the variable blank and sessions
are still created; their members just get no message. See `app/services/sessioninvite`.

The frontend turns the launch parameter back into a route in `app/router.tsx` (`startParamRoute`), so
`/sessions/:sessionId` is part of this contract, not just internal routing.

### Who may do what in a meeting

| Action | Who |
| ------ | --- |
| Read the meeting, its running order, its resolutions | any member |
| Add a «دستور جلسه» or a «مصوبه» | the **owner** (`ownerRefId`) alone |
| Change the session's status, delete the session, add a member | the **owner** alone |
| Mark a «مصوبه» done / open / canceled | its **«مسئول»** (`assigneeId`), or whoever **recorded** it (`ownerRefId`) |

The record of what one room agreed belongs to whoever called it — that's the whole split. The one exception
is marking a resolution done, which belongs as much to the person who owes it: they can report their own
work, and nobody can report it for them. Enforced by `loadSessionForOwner` and `DecisionController.Update`;
anything else is **403**.

> **This narrowed two endpoints.** Adding agendas and decisions used to be any member's, and any member of
> the room could mark any resolution done — which made «انجام شد» a claim anybody could make about somebody
> else's commitment.

`Session.ownerRefId` and `Decision.ownerRefId` are on the wire so the app can stop offering what would be
refused; the checks that matter are server-side.

### `GET /api/v1/sessions`

Every session the caller is a member of, **soonest first**. Flat and unfiltered, like `GET /jobs` — the home
calendar indexes by day itself.

```json
[
  {
    "id": "3",
    "title": "جلسه‌ی هفتگی محصول",
    "projectId": null,
    "projectName": null,
    "startsAt": "2026-08-20T09:00:00+03:30",
    "url": "https://meet.example.com/abc-defg-hij",
    "isOnline": true,
    "status": "notStarted",
    "memberCount": 4
  }
]
```

- `status` — `notStarted` | `inProgress` | `done` | `canceled`.
- `url` is the conferencing link, and it is null unless `isOnline` is true — the backend doesn't store one
  otherwise. A حضوری session has **no** place field: a room name was prose nobody could act on, whereas a
  link is the meeting itself. It is optional even for an online one, whose link may be circulated elsewhere.

### `POST /api/v1/sessions`

```json
{
  "title": "جلسه‌ی هفتگی محصول",
  "startsAt": "2026-08-20T09:00:00+03:30",
  "url": "https://meet.example.com/abc-defg-hij",
  "isOnline": true,
  "projectId": "1",
  "members": [{ "id": "101", "source": "users", "displayName": "علی رضایی", "username": "ali", "phone": null, "online": true }]
}
```

- `startsAt` — RFC 3339 **carrying the device's offset** (`toLocalIso`, not `toISOString`). The invite
  message renders the Persian wall clock from it, so a normalized UTC instant would tell an Iranian user the
  wrong time.
- `url` — optional, and stored **only when `isOnline` is true** (otherwise dropped, so flipping the switch
  can't leave a stale link behind). It travels into the invite message on its own line, where the chat
  client makes it tappable.
- `projectId` — optional; must be a project the caller belongs to (422 otherwise).
- `members` — the additionally invited people, same `PickedItem` shape `POST /projects` takes. The
  authenticated caller is added as `role: "owner"` server-side and is **not** messaged.

**Response 201** — `SessionDetail` (the session above, plus `members` and an empty `decisions`). Each member
carries `role` and `notifiedAt`:

```json
{ "id": "101", "source": "users", "displayName": "علی رضایی", "username": "ali", "phone": null, "online": true,
  "role": "member", "notifiedAt": "2026-08-13T12:00:03+03:30" }
```

`notifiedAt` is null when the bot couldn't reach them — normally because they have never started it, since a
bot can't open a chat first. **That is not an error and does not fail the request**: the session is created
either way and the create screen reports how many of the invited were actually reached.

### `GET /api/v1/sessions/:id`

`SessionDetail` — the session, its `members`, its `agendas` (in the order they were written) and its
`decisions` (by due date), in one response.
403 for a non-member, which is what makes the deep link safe to hand out: a forged `startapp` buys a 403.

### `PATCH /api/v1/sessions/:id`

`{ "status": "done" }` — **status only**. Title, time and place are what the invite message already told
everyone; changing them here would leave every member holding a message that is now wrong. **The owner
only** (403 otherwise). Returns the `Session`.

### `POST /api/v1/sessions/:id/members`

Adds people to a meeting — **the owner only** (403 otherwise). Same body as a project's:
`{ "members": [ <PickedItem>, ... ] }`.

There is no group to add them to, so this is the whole act: the rows, and **the same invite message creation
sends** — title, time, place and the `startapp=session-<id>` link. Ids already in the meeting are dropped (no
second invite about a meeting they were already told about). Sending happens before the insert, so each row is
written once already carrying whether its invite arrived.

**Response 201** — the full `SessionDetail`, so the screen can show who was reached (`members[].notifiedAt`).

### `DELETE /api/v1/sessions/:id`

Deletes the meeting — **the owner only**. Its members and its running order go with it (`ON DELETE
CASCADE`).

**Its «مصوبات» do not.** `decisions.session_id` is `ON DELETE SET NULL` by design: a commitment outlives the
room that made it. Those rows survive with no session to name — which also means they drop out of
`GET /decisions`, since that query is scoped through session membership. A meeting that simply didn't happen
is better marked `"canceled"` via `PATCH` than deleted.

**Response 204** — no body.

### `POST /api/v1/sessions/:id/agendas`

A «دستور جلسه» — one line of the meeting's running order. Written on the session screen, alongside the
مصوبات, and **only ever read back through `GET /sessions/:id`**: an agenda item outside its meeting is a
sentence with no subject, unlike a resolution, which is owed whether or not its meeting is on screen.

```json
{ "title": "بررسی پیش‌نویس قرارداد", "description": "…", "durationMinutes": 90, "assigneeId": "101" }
```

- `durationMinutes` — how long the item is meant to take, **already summed** from the picker's hours and
  minutes (1:30 → 90). Optional; `0` and absent both mean nobody budgeted it. Max 1439 (23:59), 422 above.
  This is the field that makes an agenda item the mirror image of a decision: an item is spent *inside* the
  meeting, so it carries a duration, while a resolution reaches past it and carries a `dueAt`.
- `assigneeId` — the «مسئول اجرایی». Optional, and **must be a member of that session** (422 otherwise),
  same reason a decision's must be: the display name is denormalized off the member row.

Any member may add one — the meeting is the unit of authorization, exactly as it is for decisions.

**Response 201** — the created `SessionAgenda`:

```json
{
  "id": "4",
  "sessionId": "3",
  "title": "بررسی پیش‌نویس قرارداد",
  "description": null,
  "durationMinutes": 90,
  "assigneeId": "101",
  "assigneeName": "علی رضایی"
}
```

### `GET /api/v1/decisions`

Every «مصوبه» from every session the caller is a member of, by due date. Scoped through session membership,
not authorship: a resolution assigned to you in a meeting you attended is yours to see.

```json
[
  {
    "id": "7",
    "title": "ارسال پیش‌نویس قرارداد",
    "description": null,
    "sessionId": "3",
    "sessionTitle": "جلسه‌ی هفتگی محصول",
    "agendaId": "4",
    "agendaTitle": "بررسی پیش‌نویس قرارداد",
    "dueAt": "2026-08-24T00:00:00+03:30",
    "assigneeId": "101",
    "assigneeName": "علی رضایی",
    "status": "open"
  }
]
```

- `status` — `open` | `done` | `canceled`.
- `sessionId`/`assigneeId` are null when the meeting was deleted / nobody in particular owes it.
- `agendaId`/`agendaTitle` are null when the room decided something nobody had put on the running order, and
  become null again if that agenda item is deleted — the heading goes, the commitment stays.

### `POST /api/v1/sessions/:id/decisions`

```json
{ "title": "...", "description": "…", "dueAt": "<RFC 3339>", "agendaId": "4", "assigneeId": "101" }
```

- `dueAt` — the «سررسید», picked on the Jalali calendar. Required, and offset-carrying like every other
  timestamp the client sends.
- `agendaId` — which «دستور جلسه» produced it. Optional, and **must belong to that session** (422
  otherwise): `agendaTitle` is denormalized on the wire, so pointing at another meeting's running order
  would label the resolution with a heading nobody in this room ever saw.
- `assigneeId` — optional and **must be a member of that session** (422 otherwise) — the display name is
  denormalized off the member row, so an arbitrary id would store a name nothing could ever correct.

Returns the created `Decision` (201).

### `PATCH /api/v1/decisions/:id`

`{ "status": "done" }` — status only, same reasoning as a session's. **Its «مسئول» (`assigneeId`) or whoever
recorded it (`ownerRefId`, in practice the meeting's owner)**; everyone else in the room gets a 403. The
owner is also accepted for rows written back when any member could record them, and for a resolution whose
meeting has since been deleted (`session_id` goes null, not away). Returns the `Decision`.

---

## Ledger — «دفتر مالی»

The money module. Ground truth for the shapes is `frontend/src/modules/ledger/types.ts`.

**How a ledger differs from a project and from a session, and why that's the module.** Creating a project
provisions a Rasagram supergroup and the group appearing in everyone's chat list *is* the invitation.
Creating a session provisions nothing but messages every member a deep link, because a meeting nobody was
told about is not a meeting. A ledger is the session's case: **no `chatId` and no topics, but an invite** —

```
<services.rasagram.miniapp_url>?startapp=ledger-<id>
```

with nothing appearing in anyone's chat list, a member who is never messaged has no way of learning the book
exists. Same transport as a session's, and the same consequences: `RASAGRAM_MINIAPP_URL` left blank means
books are still created and their members just get no message, delivery is recorded per member in
`notifiedAt`, and `/ledgers/:ledgerId` is part of this contract rather than internal routing because
`startParamRoute` in `app/router.tsx` is what turns the launch parameter back into it. What a ledger's
invite does *not* carry is a time or a place: it is not an event, so there is no moment to summon anyone to.
See `app/services/ledgerinvite`, and `app/services/invite` for the half it shares with sessions. The admin
API is never involved — that one is only for provisioning a project's group.

**Two rules worth reading before the endpoints:**

- **The sign lives in `type`, never in `amount`.** An amount is always a positive whole number of Tomans and
  `"expense"` is a direction. `balance` (income − expense) is the only signed figure on the wire, and it is
  routinely negative.
- **A ledger's rows travel whole.** `GET /ledgers/{id}` carries every transaction, because every screen in
  the module — the three tabs, and each of the five report periods — is a *cut* of the same array, computed
  client-side (`modules/ledger/report.ts`). There is no report endpoint and no date-range parameter; adding
  one would put a round trip behind tapping «هفته قبل» and let the book and its report disagree.

### `GET /api/v1/ledgers`

Every book the caller may write in, newest first, each already totalled — the list screen shows a balance
per row without loading a single transaction.

```json
[
  {
    "id": "1", "name": "فروشگاه مرکزی", "memberCount": 2,
    "totalIncome": 36000000, "totalExpense": 7200000, "balance": 28800000,
    "transactionCount": 5, "createdAt": "2026-08-13T18:10:00Z"
  }
]
```

### `POST /api/v1/ledgers`

```json
{ "name": "فروشگاه مرکزی", "members": [{ "id": "101", "source": "users", "displayName": "علی رضایی" }] }
```

`members` is the same `PickedItem` shape `POST /projects` and `POST /sessions` take, stored verbatim. The
caller is added as `role: "owner"` server-side, is **not** repeated if the picker also returned them, and is
**not** messaged — they are looking at the screen that made the book.

Everyone else is messaged the `startapp=ledger-<id>` link above before the member rows are written, so each
row is stored already carrying whether its invite arrived.

**Response 201** — `LedgerDetail`, i.e. the summary above plus `members`, `tags`, `sources` and
`transactions` (the last three empty by construction — all are written from the screen this redirects to).
Each member carries `role` and `notifiedAt`, exactly as a session's does:

```json
{ "id": "101", "source": "users", "displayName": "علی رضایی", "username": "ali", "phone": null, "online": true,
  "role": "member", "notifiedAt": "2026-08-13T18:10:02+03:30" }
```

`notifiedAt` is null when the bot couldn't reach them — normally because they have never started it, since a
bot can't open a chat first. **That is not an error and does not fail the request**: the book is created
either way and the create screen reports how many of the invited were actually reached.

### `GET /api/v1/ledgers/{id}`

`LedgerDetail`. 403 for a non-member, which is what makes the invite link safe to hand out: a forged
`startapp=ledger-<id>` buys a 403, not a book. Transactions come back newest first (`occurred_at DESC,
id DESC` — the id breaks ties so a list of same-minute rows doesn't reshuffle between loads).

```json
{
  "id": "1", "name": "فروشگاه مرکزی", "ownerRefId": "101", "memberCount": 2,
  "totalIncome": 36000000, "totalExpense": 7200000, "balance": 28800000,
  "transactionCount": 5, "createdAt": "2026-08-13T18:10:00Z",
  "members": [{ "id": "101", "source": "users", "displayName": "علی رضایی", "username": "ali", "phone": null,
                "online": true, "role": "member", "notifiedAt": "2026-08-13T18:10:02+03:30" }],
  "tags": [{ "id": "1", "ledgerId": "1", "name": "شعبه ۲", "color": null }],
  "sources": [{ "id": "1", "ledgerId": "1", "name": "صندوق فروشگاه" }],
  "transactions": [
    {
      "id": "5", "ledgerId": "1", "ownerRefId": "101",
      "type": "income", "amount": 24500000, "accountGroup": "sales",
      "description": "فروش نقدی روز", "sourceId": "1", "sourceName": "صندوق فروشگاه", "tagIds": ["1"],
      "assigneeId": "101", "assigneeName": "علی رضایی",
      "occurredAt": "2026-08-13T09:18:00+03:30", "createdAt": "2026-08-13T09:20:11+03:30"
    }
  ]
}
```

- `accountGroup` — one of `other` | `salary` | `bonus` | `sales` | `transfer` («سایر»، «حقوق»، «پاداش»،
  «فروش»، «انتقال»). A **fixed** five, unlike tags and sources: these are accounting categories that mean
  the same thing in every book, so a report grouped by them stays comparable between two ledgers.
- `sourceName` is denormalized (like a session's `projectName`); tags are not — a transaction is only ever
  read alongside the ledger that owns it, and that response already carries the tag pool.
- `assigneeId`/`assigneeName` — the «مسئول». Stored verbatim from whatever the picker returned and
  deliberately **not** required to be a member of the ledger: the responsible party on a receipt is a label,
  not an access grant, and the client's own contact picker reaches the whole address book.
- `ownerRefId` (on both the book and each transaction) — who keeps the book, and who wrote each line. See
  the permission table below.

### Who may do what in a book

| Action | Who |
| ------ | --- |
| Read the book, its totals, its reports | any member |
| Record a «درآمد» or «هزینه»; add a tag or a «منبع مالی» | **any member** — a shared book people can't write in is a spreadsheet |
| Delete a transaction | the member who **recorded** it (`ownerRefId`), or the book's **creator** |
| Rename or delete the book, add a member | the book's **creator** alone |

Writing is open and un-writing is not, deliberately: a balance everyone can silently edit is a balance
nobody can rely on. Enforced by `loadLedgerForOwner` and `LedgerTransactionController.Destroy`; **403**
otherwise.

### `PATCH /api/v1/ledgers/{id}`

`{ "name": "..." }` — **the creator only**. The name is all there is to edit: members are fixed at creation
(they were messaged an invite, like a session's), tags and sources have their own endpoints, and the balance
is derived from the lines. Blank name is 422. Returns the full `LedgerDetail`.

### `POST /api/v1/ledgers/{id}/members`

Adds people to a book — **the creator only** (403 otherwise). Same body and same mechanics as a session's: no
group exists, so the rows plus the `startapp=ledger-<id>` invite are all of it, duplicates are dropped, and the
invite is sent before the insert so `notifiedAt` is written with the row.

Everyone added can immediately record income and expenses — that half of the book is deliberately open to
every member (see the permission table above).

**Response 201** — the full `LedgerDetail`.

### `DELETE /api/v1/ledgers/{id}`

Deletes the book — **the creator only** — and with it every line anyone ever recorded in it, plus its tags
and its sources (all `ON DELETE CASCADE`; nothing outside the book points into it). No undo; the app warns
first. **Response 204** — no body.

### `POST /api/v1/ledgers/{id}/transactions`

```json
{
  "type": "expense", "amount": 1000000, "accountGroup": "transfer", "description": "کرایه حمل بار",
  "sourceId": "1", "tagIds": ["1"],
  "assignee": { "id": "101", "source": "users", "displayName": "علی رضایی" },
  "occurredAt": "2026-08-13T11:18:00+03:30"
}
```

- `type` and a positive `amount` are the only required fields. **`amount` ≤ 0 is 422** — a line worth
  nothing moves no money.
- `accountGroup` defaults to `other`; anything outside the five is 422.
- `sourceId` and every `tagIds` entry must belong to **this** ledger, otherwise 422.
- `assignee` is the whole picked item; both its `id` and `displayName` must be present or it is ignored.
- `occurredAt` is RFC 3339 carrying the device's offset (`toLocalIso`) and is the day every period report
  groups by — not `createdAt`, since a receipt is often entered days after the fact. Absent means now.

**Response 201** — the created `LedgerTransaction`.

### `DELETE /api/v1/ledgers/{id}/transactions/{transactionId}`

**Response 204.** The module's only destructive call, and its only editing: correcting a mistyped amount is
deleting the line and writing it again. **The member who recorded the line, or the book's creator** — 403
for anyone else. (It used to be any member's; see the permission table above for why it isn't.) A
`transactionId` from another book reads as 404.

### `POST /api/v1/ledgers/{id}/tags` and `POST /api/v1/ledgers/{id}/sources`

The two ledger-scoped pools a transaction draws from. Both take `{ "name": ... }` (tags also accept an
optional `"color"`), both are **write-only here** — they are read as part of `GET /ledgers/{id}` — and both
return an existing row with **200** instead of failing when the name is already taken, the same
create-or-return `POST /projects/{id}/tags` does.

«منبع مالی» is a pool rather than a fixed enum precisely because `accountGroup` is the opposite: a source is
a thing this particular business owns («صندوق فروشگاه», «کارت بانک ملت») and only its own bookkeeper can
name it.

---

## Not in v1 (deliberately out of scope, see plan)

- ~~Adding members to a project after creation~~ — **shipped**. `rasagram-new-admin` does have the endpoint:
  `POST /x/internal/channel/addParticipants`. See `POST /projects/:id/members` above. *Removing* a member is
  still out of scope — that belongs in the messenger.
- ~~Editing/deleting a project~~ — **shipped**, see `PATCH`/`DELETE /projects/:id` above (creator only;
  deleting takes the Rasagram group with it).
- ~~Editing a Job, or toggling a checklist item~~ — **shipped**, see `PATCH /projects/:id/jobs/:jobId` above.
  ~~*Deleting* a Job is still out of scope.~~ — also shipped, `DELETE /projects/:id/jobs/:jobId`.
- ~~Job activity/history («فعالیت‌ها»)~~ — **not built, and no longer needed.** The «فعالیت‌ها» button now
  hands off to the project's group in the Rasagram client, opening the topic of whichever list is on screen
  (`openTelegramLink` with `/c/<chatId>/<topicId>` — see `modules/project/links.ts`). The group already *is*
  the activity feed, so there is nothing here to build or keep in sync.
- ~~Adding participants to a session after creation, or editing/deleting one~~ — adding and deleting are
  **shipped** (owner only; adding sends the same invite). *Editing* a session is still `status` only, for the
  original reason: the invite message already went out with a time, a place and a link, and nothing can recall
  it.
- Re-sending a failed session invite. The session screen names who wasn't reached so it can be done by hand;
  a retry button would keep failing for exactly the same reason (they've never started the bot) until they
  do something the app can't make them do.
- Editing, reordering or deleting a «دستور جلسه», and editing or deleting a «مصوبه» (a decision's `status`
  is mutable, its text is not). Both are written on the session screen and read there; the schema is ready
  for the rest (`decisions.agenda_id` is `NullOnDelete`) but no endpoint exposes it yet.
- Attaching files to a session, an agenda item or a decision. The «فایل» rows on those screens are not
  built — nothing in the meeting module uploads yet.
- **Editing a ledger transaction, or renaming/deleting a ledger, a tag or a source.** Deleting a
  transaction *is* shipped (see above) and is the module's answer to a mistyped amount: remove the line and
  write it again. A partial `PATCH` would be the first place in the app where a stored total could be
  changed without a trace of what it used to be, which a book people share is exactly the wrong place for.
- Adding someone to a ledger after it is created, for the same reason a project's and a session's members
  are fixed.
- **Naming who a ledger's invite didn't reach.** The response carries `members[].notifiedAt` and the create
  screen reports the count once, but the book screen has no member list to show it on afterwards — unlike
  the session screen, which names them. Re-sending is not built here either, for the reason above.
- A balance *per «منبع مالی»*. Sources are labels on transactions today, not accounts with their own
  running totals — the schema is ready for it (`ledger_transactions.source_id`), nothing computes it.
- Recurring transactions, attachments (a photo of a receipt), and any export. All three are the obvious next
  things a real bookkeeper asks for; none is built.
