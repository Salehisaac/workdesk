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

	userIdSet := map[int64]bool{botId: true, creatorId: true}
	for _, member := range request.Members {
		id, err := strconv.ParseInt(member.Id, 10, 64)
		if err != nil {
			return ctx.Response().Status(422).Json(http.Json{"error": "member id \"" + member.Id + "\" is not a valid user id"})
		}
		userIdSet[id] = true
	}
	userIds := make([]int64, 0, len(userIdSet))
	for id := range userIdSet {
		userIds = append(userIds, id)
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

	return ctx.Response().Status(201).Json(resources.Project(&project))
}
