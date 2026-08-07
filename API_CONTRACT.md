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

## One thing that doesn't work end-to-end yet

`POST /projects` (below) requires a `chatId` that the **frontend** is supposed to obtain by calling
`bridge.createGroup()` before the request — but that method **does not exist** in the real
`Rasagram.WebApp` SDK (confirmed by reading the actual deployed script; see plan section 8 / "Open Risks"
#1). So the create-project flow can't be exercised end-to-end from the real UI until that's resolved one
way or another. You can still implement and test this endpoint by passing any string as `chatId` by hand
(curl, Postman, etc.) — the frontend code and this contract are otherwise ready to go the moment a real
`chatId` is obtainable.

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
  "chatId": "-1001234567890",
  "members": [
    { "id": "101", "source": "contacts", "displayName": "علی رضایی", "username": "ali", "phone": "989120000001", "online": true }
  ]
}
```

- `avatarUrl` — omitted if no avatar was picked.
- `joinSlug` — omitted when `visibility` is `"private"`. When present: English letters/digits/`-`/`_`,
  first character a letter (validated client-side already, worth re-validating server-side too).
- `chatId` — required (see the caveat above for why it can't be exercised from the real UI yet).
- `members[].source` — one of `users` | `contacts` | `groups` | `channels` | `bots` | `recentChats` | `favorites`.
  Store the whole item verbatim (`id` + `source` + denormalized display fields) as an opaque reference —
  don't try to resolve or join it against any other table (plan constraint #3 — no gRPC to teamgram-server).

**Backend behavior:**

1. Resolve the authenticated user from initData.
2. Create the `projects` row.
3. Insert `project_members`: the authenticated user (as owner) + every item in `members`.
4. Call the Bot API's `promoteChatMember` (confirmed endpoint, `teamgram.io/bots`' `botway` service —
   `POST /bot<token>/promoteChatMember`) to give WorkDesk's own bot admin/manage-topics rights in `chatId`,
   so it can create forum topics later (step below). Best-effort — no user-facing recovery path exists in
   v1's UI if this fails, so at minimum log it.

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
    { "id": "10", "projectId": "1", "name": "کارهای این هفته", "topicId": "42" }
  ]
}
```

Return 403 or 404 (either is fine — the frontend just treats any non-2xx as an error state) if the
authenticated user isn't a member of this project.

---

## `POST /api/v1/projects/:id/lists`

**Request body:**

```json
{ "name": "کارهای این هفته" }
```

**Backend behavior:**

1. Create the `lists` row (`project_id`, `name`).
2. Call the Bot API's `createForumTopic` (confirmed endpoint — `POST /bot<token>/createForumTopic`) against
   the project's `chatId`, using `name` as the topic name.
3. Store the returned topic id as `topicId`.

**Response 201:**

```json
{ "id": "10", "projectId": "1", "name": "کارهای این هفته", "topicId": "42" }
```

---

## `DELETE /api/v1/projects/:id/lists/:listId`

Calls the Bot API's `deleteForumTopic` (confirmed endpoint — `POST /bot<token>/deleteForumTopic`) for the
list's `topicId` inside the project's `chatId`, then deletes the row.

**Response 204** — no body.

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

- Adding members to a project after creation (blocked on the same bridge gap as `chatId` — see plan
  section 8 point 5).
- Editing/deleting a project.
- Anything about Jobs (tasks inside a List) — the frontend doesn't render or fetch these yet; `List` only
  carries `id`/`projectId`/`name`/`topicId` right now, per the plan's explicit scoping for this round.
