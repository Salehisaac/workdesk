package controllers

import (
	"errors"
	"fmt"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
	"goravel/app/http/resources"
	"goravel/app/models"
	"goravel/app/services/projectfeed"
	"goravel/app/services/rasagramadmin"
)

type ProjectController struct{}

func NewProjectController() *ProjectController {
	return &ProjectController{}
}

// currentUser resolves the authenticated identity or writes a 401 itself —
// callers should treat a non-nil second return as "already responded."
func currentUser(ctx http.Context) (*models.AuthUser, http.Response) {
	var authUser models.AuthUser
	if err := facades.Auth(ctx).User(&authUser); err != nil {
		return nil, ctx.Response().Status(401).Json(http.Json{"error": err.Error()})
	}
	return &authUser, nil
}

// loadProjectForMember loads a project by its {id} route param and verifies
// the given user is a member (owner or invited) — shared by every endpoint
// scoped to a single project. Returns a written response on any failure.
func loadProjectForMember(ctx http.Context, userId string) (*models.Project, http.Response) {
	var project models.Project
	if err := facades.Orm().Query().With("Members").With("Lists").Find(&project, ctx.Request().Route("id")); err != nil {
		return nil, ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}
	if project.ID == 0 {
		return nil, ctx.Response().Status(404).Json(http.Json{"error": "project not found"})
	}

	for _, member := range project.Members {
		if member.RefId == userId && member.RefSource == "users" {
			return &project, nil
		}
	}
	return nil, ctx.Response().Status(403).Json(http.Json{"error": "not a member of this project"})
}

// isProjectOwner reports whether userId is the member who created the project —
// the role stamped at creation, and the only one that outranks anyone else here.
func isProjectOwner(project *models.Project, userId string) bool {
	for _, member := range project.Members {
		if member.RefId == userId && member.RefSource == "users" && member.Role == models.ProjectMemberRoleOwner {
			return true
		}
	}
	return false
}

// canManage answers who may edit or delete one thing INSIDE a project — a list,
// a job: the person who made it, and the project's creator.
//
// The asymmetry with creation is deliberate. Anyone in a project can add a list
// or file a job, because a project is a shared workspace and gating that would
// make it one person's. Removing or rewriting what someone else put there is a
// different act, so it stays with them — and with the project's creator, who
// needs some way to clean up after members who have moved on.
//
// createdBy is empty on rows written before the column existed, which matches no
// caller and so leaves those to the project's creator alone.
func canManage(project *models.Project, userId, createdBy string) bool {
	if createdBy != "" && createdBy == userId {
		return true
	}
	return isProjectOwner(project, userId)
}

// loadProjectForOwner is loadProjectForMember with the stricter check the two
// destructive endpoints need: renaming a project and deleting it (with its
// Rasagram group, and every list and job in it) are the creator's alone.
//
// Membership is checked first so someone outside the project can't tell an id
// that exists from one that doesn't — a non-member gets the same 403 either way.
func loadProjectForOwner(ctx http.Context, userId string) (*models.Project, http.Response) {
	project, errResp := loadProjectForMember(ctx, userId)
	if errResp != nil {
		return nil, errResp
	}

	if !isProjectOwner(project, userId) {
		return nil, ctx.Response().Status(403).Json(http.Json{"error": "only the project's creator can do this"})
	}
	return project, nil
}

// Index — GET /api/v1/projects.
func (r *ProjectController) Index(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	var memberships []models.ProjectMember
	if err := facades.Orm().Query().
		Where("ref_id", authUser.ID).
		Where("ref_source", "users").
		Find(&memberships); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}
	if len(memberships) == 0 {
		return ctx.Response().Success().Json(resources.Projects(nil))
	}

	projectIds := make([]any, len(memberships))
	for i, membership := range memberships {
		projectIds[i] = membership.ProjectId
	}

	var projects []models.Project
	if err := facades.Orm().Query().
		With("Members").
		WhereIn("id", projectIds).
		OrderByDesc("created_at").
		Find(&projects); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Success().Json(resources.Projects(projects))
}

// Show — GET /api/v1/projects/{id}.
func (r *ProjectController) Show(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	project, errResp := loadProjectForMember(ctx, authUser.ID)
	if errResp != nil {
		return errResp
	}

	return ctx.Response().Success().Json(resources.ProjectDetail(project))
}

type storePickedItemRequest struct {
	Id          string  `json:"id"`
	Source      string  `json:"source"`
	DisplayName string  `json:"displayName"`
	Username    *string `json:"username"`
	Phone       *string `json:"phone"`
	Online      bool    `json:"online"`
}

type storeProjectRequest struct {
	Name       string                   `json:"name"`
	AvatarUrl  *string                  `json:"avatarUrl"`
	Visibility string                   `json:"visibility"`
	JoinSlug   *string                  `json:"joinSlug"`
	Members    []storePickedItemRequest `json:"members"`
}

// uploadedAvatarPattern is what a URL from POST /uploads looks like — the
// inverse of PublicUploadUrl, pinned down to exactly the shape that endpoint
// produces (a flat filename under uploads/, no directory separators).
//
// The strictness is the point. avatarUrl arrives from the client and is about
// to be turned into a filesystem read, so anything looser lets "../../.env" or
// an absolute path walk out of the uploads directory and hand the file's bytes
// to a chat. Matching a known-good shape rather than trying to reject bad ones
// is what makes that impossible instead of merely unlikely.
var uploadedAvatarPattern = regexp.MustCompile(`^/storage/(uploads/[A-Za-z0-9][A-Za-z0-9._-]*)$`)

// uploadedAvatar reads a previously uploaded avatar off the public disk so it
// can be handed to the admin API as the new group's photo.
//
// Callers treat failure as non-fatal — a project whose group has no picture
// still works.
func uploadedAvatar(avatarUrl string) (*rasagramadmin.Photo, error) {
	match := uploadedAvatarPattern.FindStringSubmatch(avatarUrl)
	if match == nil {
		// Not one of ours — an externally hosted avatar, or something crafted.
		// Either way there's no local file to upload, and we don't fetch
		// arbitrary URLs on the client's behalf (that's an SSRF).
		return nil, fmt.Errorf("avatarUrl %q is not an uploaded file", avatarUrl)
	}
	diskPath := match[1]

	content, err := facades.Storage().Disk("public").Get(diskPath)
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", diskPath, err)
	}

	return &rasagramadmin.Photo{Filename: filepath.Base(diskPath), Content: []byte(content)}, nil
}

// botUserId extracts the bot's numeric user id from the same
// RASAGRAM_BOT_TOKEN used for initData verification — standard bot tokens
// are "<id>:<secret>", so there's no need for a second config value just to
// duplicate what's already in the token.
func botUserId() (int64, error) {
	token := facades.Config().GetString("services.rasagram.bot_token")
	id, _, found := strings.Cut(token, ":")
	if !found {
		return 0, errors.New("RASAGRAM_BOT_TOKEN is not in \"<id>:<secret>\" format")
	}
	return strconv.ParseInt(id, 10, 64)
}

// Store — POST /api/v1/projects. Provisions the project's dedicated
// topic-group itself now (plan section 8) — create chat, upgrade to
// supergroup, enable topics — via the internal admin API
// (app/services/rasagramadmin). The frontend no longer needs to create
// anything client-side first; chatId is not part of the request anymore.
func (r *ProjectController) Store(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	var request storeProjectRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "invalid request body"})
	}

	if strings.TrimSpace(request.Name) == "" {
		return ctx.Response().Status(422).Json(http.Json{"error": "name is required"})
	}
	if request.Visibility != models.ProjectVisibilityPrivate && request.Visibility != models.ProjectVisibilityPublic {
		return ctx.Response().Status(422).Json(http.Json{"error": "visibility must be \"private\" or \"public\""})
	}

	creatorId, err := strconv.ParseInt(authUser.ID, 10, 64)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": "could not parse authenticated user id"})
	}

	botId, err := botUserId()
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": "services.rasagram.bot_token is not configured correctly"})
	}

	// Order matters, and only for the first entry: the admin API's chat/create
	// makes user_ids[0] the group's OWNER. So the person creating the project
	// leads the list, then the bot (which only needs to be in the group to run
	// the topic lifecycle), then everyone they picked. This used to be built from
	// a map, whose iteration order is randomized — which handed ownership of the
	// group to whichever member happened to come out first, often the bot.
	seen := make(map[int64]bool, len(request.Members)+2)
	userIds := make([]int64, 0, len(request.Members)+2)
	addUserId := func(id int64) {
		if seen[id] {
			return
		}
		seen[id] = true
		userIds = append(userIds, id)
	}

	addUserId(creatorId)
	addUserId(botId)
	for _, member := range request.Members {
		id, err := strconv.ParseInt(member.Id, 10, 64)
		if err != nil {
			return ctx.Response().Status(422).Json(http.Json{"error": "member id \"" + member.Id + "\" is not a valid user id"})
		}
		addUserId(id)
	}

	// The avatar the user picked rides along with the group's creation now, so
	// a project that has one gets its group photo in the same call. Failing to
	// read the file back is non-fatal: a project whose group has no picture is
	// a cosmetic loss, not a reason to refuse to create the project.
	var photo *rasagramadmin.Photo
	if request.AvatarUrl != nil {
		photo, err = uploadedAvatar(*request.AvatarUrl)
		if err != nil {
			facades.Log().Error("workdesk: reading the project group's photo failed: " + err.Error())
		}
	}

	channelId, err := rasagramadmin.New().CreateTopicGroup(request.Name, userIds, photo)
	if err != nil {
		facades.Log().Error("workdesk: CreateTopicGroup failed: " + err.Error())
		return ctx.Response().Status(502).Json(http.Json{"error": "could not create the project's group: " + err.Error()})
	}
	chatId := strconv.FormatInt(channelId, 10)

	project := models.Project{
		Name:       request.Name,
		AvatarUrl:  request.AvatarUrl,
		Visibility: request.Visibility,
		ChatId:     &chatId,
		// "What parent context is this Project attached to" is still an open
		// question (plan section 6) — chatId doubles as owner_id for now,
		// the only value actually available today.
		OwnerType: "chat",
		OwnerId:   chatId,
	}
	if request.Visibility == models.ProjectVisibilityPublic {
		project.JoinSlug = request.JoinSlug
	}

	if err := facades.Orm().Query().Create(&project); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	displayName := strings.TrimSpace(authUser.FirstName + " " + authUser.LastName)
	members := []models.ProjectMember{
		{ProjectId: project.ID, RefId: authUser.ID, RefSource: "users", DisplayName: displayName, Online: true, Role: models.ProjectMemberRoleOwner},
	}
	for _, member := range request.Members {
		members = append(members, models.ProjectMember{
			ProjectId:   project.ID,
			RefId:       member.Id,
			RefSource:   member.Source,
			DisplayName: member.DisplayName,
			Username:    member.Username,
			Phone:       member.Phone,
			Online:      member.Online,
			Role:        models.ProjectMemberRoleMember,
		})
	}
	if err := facades.Orm().Query().Create(&members); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}
	project.Members = members

	// The group has just appeared in every member's chat list, so the first
	// thing they find in it says what it is and links back into the app.
	// Best-effort by design — see app/services/projectfeed.
	projectfeed.AnnounceProject(&project)

	return ctx.Response().Status(201).Json(resources.Project(&project))
}

// updateProjectRequest is PATCH-shaped, the same way updateJobRequest is: every
// field is a pointer and only the ones actually PRESENT in the body are touched,
// so a screen that only renames a project doesn't have to resend (and risk
// clobbering) the rest of it.
//
// Members are deliberately absent. A project's members are the members of its
// Rasagram group, and that group is the source of truth for them — adding or
// removing people happens in the messenger, not here (the create screen says as
// much: «پس از ساخت پروژه نمی‌توانید عضو تازه‌ای اضافه کنید»).
type updateProjectRequest struct {
	Name       *string `json:"name"`
	AvatarUrl  *string `json:"avatarUrl"`
	Visibility *string `json:"visibility"`
	JoinSlug   *string `json:"joinSlug"`
}

// Update — PATCH /api/v1/projects/{id}. The creator's alone (loadProjectForOwner).
//
// This changes WorkDesk's own record and nothing else. The Rasagram group keeps
// the title and photo it was created with, because the platform's Bot API can't
// change either: botway's setChatTitle and setChatPhoto handlers are both stubs
// that return "not impl" (read directly, same as every other claim in
// app/services/botapi), and the admin API has no rename route at all. Worth
// stating rather than leaving as a surprise — a renamed project keeps the old
// name on its group until one of those exists.
func (r *ProjectController) Update(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	project, errResp := loadProjectForOwner(ctx, authUser.ID)
	if errResp != nil {
		return errResp
	}

	var request updateProjectRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "invalid request body"})
	}

	if request.Name != nil {
		name := strings.TrimSpace(*request.Name)
		if name == "" {
			return ctx.Response().Status(422).Json(http.Json{"error": "name is required"})
		}
		project.Name = name
	}

	if request.Visibility != nil {
		if *request.Visibility != models.ProjectVisibilityPrivate && *request.Visibility != models.ProjectVisibilityPublic {
			return ctx.Response().Status(422).Json(http.Json{"error": "visibility must be \"private\" or \"public\""})
		}
		project.Visibility = *request.Visibility
	}

	if request.AvatarUrl != nil {
		// Present-but-empty clears the picture, the same way an empty dueAt
		// clears a job's deadline. The bytes aren't re-uploaded anywhere: the
		// group's photo was set when it was created and can't be changed from
		// here (see the note above), so this is the app's own avatar only.
		if avatarUrl := strings.TrimSpace(*request.AvatarUrl); avatarUrl != "" {
			project.AvatarUrl = &avatarUrl
		} else {
			project.AvatarUrl = nil
		}
	}

	if request.JoinSlug != nil {
		if joinSlug := strings.TrimSpace(*request.JoinSlug); joinSlug != "" {
			project.JoinSlug = &joinSlug
		} else {
			project.JoinSlug = nil
		}
	}
	// A private project has no join link, whichever order the two fields arrived
	// in — same rule Store applies when it only sets JoinSlug for a public one.
	if project.Visibility == models.ProjectVisibilityPrivate {
		project.JoinSlug = nil
	}

	if err := facades.Orm().Query().Save(project); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Success().Json(resources.ProjectDetail(project))
}

// Destroy — DELETE /api/v1/projects/{id}. The creator's alone, and final: the
// project's Rasagram group is deleted with it, taking every list (topic) and
// every message in them. The frontend warns before calling this; there is no
// undo on either side.
//
// Everything the project owns goes with the row, without a single delete here:
// project_members, lists, project_jobs and the job pivots all carry
// ON DELETE CASCADE, and sessions/notes filed under the project carry
// ON DELETE SET NULL, so a meeting or a note survives and simply stops naming a
// project that no longer exists (see the migrations).
//
// The group is deleted BEFORE the row, and only its failure is tolerated — the
// asymmetry is deliberate. A group that's gone while the project remains is
// recoverable: deleting again logs a failure for a channel that has already gone
// and finishes the job. The other order isn't — once the row is gone nothing
// remembers the chat id, and the group would outlive its project with no way
// back to it. Same stance list deletion takes: an external cleanup call failing
// must not trap the user with something they can't remove.
func (r *ProjectController) Destroy(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	project, errResp := loadProjectForOwner(ctx, authUser.ID)
	if errResp != nil {
		return errResp
	}

	if project.ChatId != nil && strings.TrimSpace(*project.ChatId) != "" {
		chatId := strings.TrimSpace(*project.ChatId)
		if channelId, err := strconv.ParseInt(chatId, 10, 64); err != nil {
			facades.Log().Error("workdesk: project «" + project.Name + "» has a non-numeric chat id (" + chatId + "), its group was left standing: " + err.Error())
		} else if err := rasagramadmin.New().DeleteChannel(channelId); err != nil {
			facades.Log().Error("workdesk: deleting project «" + project.Name + "»'s group (" + chatId + ") failed: " + err.Error())
		}
	}

	if _, err := facades.Orm().Query().Delete(project); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().NoContent(204)
}

type storeProjectMembersRequest struct {
	Members []storePickedItemRequest `json:"members"`
}

// StoreMembers — POST /api/v1/projects/{id}/members. The creator's alone.
//
// Adding someone to a project means adding them to its Rasagram group, and that
// half comes FIRST: the group is what a project's membership actually is — every
// list is a topic in it — so a project_members row for someone who isn't in the
// group would name a person who can't see any of the work it's about. If the
// invite fails, nothing is written and the caller gets a 502, the same
// all-or-nothing stance creation takes.
//
// Ids already in the project are dropped rather than rejected: a picker that
// returned an existing member is a duplicate, not an error, and answering 422
// would make adding two people fail because one of them was already there.
func (r *ProjectController) StoreMembers(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	project, errResp := loadProjectForOwner(ctx, authUser.ID)
	if errResp != nil {
		return errResp
	}

	var request storeProjectMembersRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "invalid request body"})
	}
	if len(request.Members) == 0 {
		return ctx.Response().Status(422).Json(http.Json{"error": "members is required"})
	}

	existing := make(map[string]bool, len(project.Members))
	for _, member := range project.Members {
		existing[member.RefId] = true
	}

	userIds := make([]int64, 0, len(request.Members))
	members := make([]models.ProjectMember, 0, len(request.Members))
	for _, member := range request.Members {
		if existing[member.Id] {
			continue
		}
		// Same reason Store parses these: the id is about to be sent to the
		// admin API as a user id, so anything that isn't one has to be refused
		// here rather than half-applied there.
		id, err := strconv.ParseInt(member.Id, 10, 64)
		if err != nil {
			return ctx.Response().Status(422).Json(http.Json{"error": "member id \"" + member.Id + "\" is not a valid user id"})
		}

		existing[member.Id] = true
		userIds = append(userIds, id)
		members = append(members, models.ProjectMember{
			ProjectId:   project.ID,
			RefId:       member.Id,
			RefSource:   member.Source,
			DisplayName: member.DisplayName,
			Username:    member.Username,
			Phone:       member.Phone,
			Online:      member.Online,
			Role:        models.ProjectMemberRoleMember,
		})
	}

	// Everyone asked for is already here — nothing to do, and the project as it
	// stands is the honest answer.
	if len(members) == 0 {
		return ctx.Response().Success().Json(resources.ProjectDetail(project))
	}

	if project.ChatId == nil || strings.TrimSpace(*project.ChatId) == "" {
		return ctx.Response().Status(500).Json(http.Json{"error": "project has no group to add anyone to"})
	}
	channelId, err := strconv.ParseInt(strings.TrimSpace(*project.ChatId), 10, 64)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": "project's chat id is not numeric"})
	}

	if err := rasagramadmin.New().AddChannelParticipants(channelId, userIds); err != nil {
		facades.Log().Error("workdesk: AddChannelParticipants failed: " + err.Error())
		return ctx.Response().Status(502).Json(http.Json{"error": "could not add them to the project's group: " + err.Error()})
	}

	if err := facades.Orm().Query().Create(&members); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}
	project.Members = append(project.Members, members...)

	return ctx.Response().Status(201).Json(resources.ProjectDetail(project))
}
