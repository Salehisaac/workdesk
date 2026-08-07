package controllers

import (
	"strings"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
	"goravel/app/http/resources"
	"goravel/app/models"
)

// ProjectListController handles Lists nested under a Project — plan section
// 8 (Project → List → Job, only List exists so far).
type ProjectListController struct{}

func NewProjectListController() *ProjectListController {
	return &ProjectListController{}
}

type storeListRequest struct {
	Name string `json:"name"`
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

	list := models.List{ProjectId: project.ID, Name: request.Name}
	if err := facades.Orm().Query().Create(&list); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	// plan section 8: createForumTopic(project.ChatId, list.Name) -> should
	// set list.TopicId. Not implemented — no Bot API client exists yet.
	facades.Log().Warning("workdesk: skipping createForumTopic — Bot API client not implemented yet (plan section 8)")

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

	// plan section 8: deleteForumTopic(project.ChatId, list.TopicId) should
	// happen before the row goes away. Not implemented — no Bot API client
	// exists yet.
	facades.Log().Warning("workdesk: skipping deleteForumTopic — Bot API client not implemented yet (plan section 8)")

	if _, err := facades.Orm().Query().Delete(&list); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().NoContent(204)
}
