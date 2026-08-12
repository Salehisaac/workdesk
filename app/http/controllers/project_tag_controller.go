package controllers

import (
	"strings"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
	"goravel/app/http/resources"
	"goravel/app/models"
)

// ProjectTagController handles the tag pool a Project's Jobs draw from. Tags
// are project-scoped on purpose: a tag defined while creating a job in one list
// is immediately available to every job in every other list of that project.
type ProjectTagController struct{}

func NewProjectTagController() *ProjectTagController {
	return &ProjectTagController{}
}

type storeTagRequest struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

// Index — GET /api/v1/projects/{id}/tags.
func (r *ProjectTagController) Index(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	project, errResp := loadProjectForMember(ctx, authUser.ID)
	if errResp != nil {
		return errResp
	}

	var tags []models.ProjectTag
	if err := facades.Orm().Query().Where("project_id", project.ID).OrderBy("name").Find(&tags); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Success().Json(resources.ProjectTags(tags))
}

// Store — POST /api/v1/projects/{id}/tags.
func (r *ProjectTagController) Store(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	project, errResp := loadProjectForMember(ctx, authUser.ID)
	if errResp != nil {
		return errResp
	}

	var request storeTagRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "invalid request body"})
	}
	name := strings.TrimSpace(request.Name)
	if name == "" {
		return ctx.Response().Status(422).Json(http.Json{"error": "name is required"})
	}

	// Names are unique per project (see the migration). Re-creating an existing
	// tag returns it instead of failing: from the sheet's point of view "make
	// this tag" and "give me this tag" are the same intent, and the client then
	// selects whatever comes back.
	var existing models.ProjectTag
	if err := facades.Orm().Query().Where("project_id", project.ID).Where("name", name).First(&existing); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}
	if existing.ID != 0 {
		return ctx.Response().Success().Json(resources.ProjectTag(&existing))
	}

	tag := models.ProjectTag{ProjectId: project.ID, Name: name}
	if color := strings.TrimSpace(request.Color); color != "" {
		tag.Color = &color
	}
	if err := facades.Orm().Query().Create(&tag); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Status(201).Json(resources.ProjectTag(&tag))
}
