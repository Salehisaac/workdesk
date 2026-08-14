package controllers

import (
	"strings"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
	"goravel/app/http/resources"
	"goravel/app/models"
	"goravel/app/services/botapi"
	"goravel/app/services/projectfeed"
)

// ProjectListController handles Lists nested under a Project — plan section
// 8 (Project → List → Job, only List exists so far).
type ProjectListController struct{}

func NewProjectListController() *ProjectListController {
	return &ProjectListController{}
}

type storeListRequest struct {
	Name              string `json:"name"`
	IconColor         int64  `json:"iconColor"`
	IconCustomEmojiId string `json:"iconCustomEmojiId"`
	// Denormalized display copies of the chosen icon — not sent to the Bot
	// API, just stored so the frontend never has to re-fetch/match
	// GET /topic-icons to render it later. Trusted verbatim, same as
	// ProjectMember's picked-item display fields.
	IconEmoji  string `json:"iconEmoji"`
	IconFileId string `json:"iconFileId"`
}

func isValidIconColor(color int64) bool {
	if color == 0 {
		return true
	}
	for _, allowed := range botapi.ForumTopicColors {
		if allowed == color {
			return true
		}
	}
	return false
}

// Store — POST /api/v1/projects/{id}/lists.
func (r *ProjectListController) Store(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	project, errResp := loadProjectForMember(ctx, authUser.ID)
	if errResp != nil {
		return errResp
	}

	var request storeListRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "invalid request body"})
	}
	if strings.TrimSpace(request.Name) == "" {
		return ctx.Response().Status(422).Json(http.Json{"error": "name is required"})
	}
	if !isValidIconColor(request.IconColor) {
		return ctx.Response().Status(422).Json(http.Json{"error": "iconColor must be one of the standard topic colors"})
	}

	if project.ChatId == nil || strings.TrimSpace(*project.ChatId) == "" {
		return ctx.Response().Status(500).Json(http.Json{"error": "project has no chat to attach a topic to"})
	}

	topicId, err := botapi.New().CreateForumTopic(*project.ChatId, request.Name, request.IconColor, request.IconCustomEmojiId)
	if err != nil {
		facades.Log().Error("workdesk: CreateForumTopic failed: " + err.Error())
		return ctx.Response().Status(502).Json(http.Json{"error": "could not create the list's topic: " + err.Error()})
	}

	list := models.List{ProjectId: project.ID, Name: request.Name, TopicId: &topicId}
	if request.IconColor != 0 {
		list.IconColor = &request.IconColor
	}
	if request.IconCustomEmojiId != "" {
		list.IconCustomEmojiId = &request.IconCustomEmojiId
	}
	if request.IconEmoji != "" {
		list.IconEmoji = &request.IconEmoji
	}
	if request.IconFileId != "" {
		list.IconFileId = &request.IconFileId
	}
	if err := facades.Orm().Query().Create(&list); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	// The topic exists but is empty until something is said in it — this is its
	// first message, saying which list it is. Best-effort, like every other
	// announcement (app/services/projectfeed).
	projectfeed.AnnounceList(project, &list)

	return ctx.Response().Status(201).Json(resources.List(&list))
}

// Destroy — DELETE /api/v1/projects/{id}/lists/{listId}.
func (r *ProjectListController) Destroy(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	project, errResp := loadProjectForMember(ctx, authUser.ID)
	if errResp != nil {
		return errResp
	}

	var list models.List
	if err := facades.Orm().Query().
		Where("project_id", project.ID).
		Find(&list, ctx.Request().Route("listId")); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}
	if list.ID == 0 {
		return ctx.Response().Status(404).Json(http.Json{"error": "list not found"})
	}

	if project.ChatId != nil && list.TopicId != nil && strings.TrimSpace(*list.TopicId) != "" {
		if err := botapi.New().DeleteForumTopic(*project.ChatId, *list.TopicId); err != nil {
			facades.Log().Error("workdesk: DeleteForumTopic failed: " + err.Error())
		}
	}

	if _, err := facades.Orm().Query().Delete(&list); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().NoContent(204)
}
