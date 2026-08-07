package controllers

import (
	"strings"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
	"goravel/app/http/resources"
	"goravel/app/models"
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
	ChatId     string                   `json:"chatId"`
	Members    []storePickedItemRequest `json:"members"`
}

// Store — POST /api/v1/projects. See API_CONTRACT.md: chatId is expected to
// come from bridge.createGroup(), which doesn't exist in the real SDK yet
// (plan "Open Risks" #1) — this endpoint works fine against a hand-supplied
// chatId, it just can't be reached from the real create-wizard yet.
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
	if strings.TrimSpace(request.ChatId) == "" {
		return ctx.Response().Status(422).Json(http.Json{"error": "chatId is required"})
	}

	chatId := request.ChatId
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

	// plan section 8: promoteChatMember(chatId, botUserId) so the bot can
	// manage forum topics in this group. Not implemented — no Bot API
	// client exists in this repo yet, only the picture of what it'll call
	// (teamgram.io/bots' botway service). Logged, not silently skipped.
	facades.Log().Warning("workdesk: skipping promoteChatMember — Bot API client not implemented yet (plan section 8)")

	return ctx.Response().Status(201).Json(resources.Project(&project))
}
