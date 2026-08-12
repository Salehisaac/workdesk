package controllers

import (
	"strconv"
	"strings"

	"github.com/goravel/framework/contracts/http"
	"github.com/goravel/framework/support/carbon"

	"goravel/app/facades"
	"goravel/app/http/resources"
	"goravel/app/models"
)

// Ids cross the wire as strings (see resources.formatId) — this is the same
// conversion on the way back in, for matching request ids against model ids.
func formatModelId(id uint) string {
	return strconv.FormatUint(uint64(id), 10)
}

// JobController handles Jobs — the third level of Project → List → Job, and the
// only one that carries a deadline.
type JobController struct{}

func NewJobController() *JobController {
	return &JobController{}
}

type storeChecklistItemRequest struct {
	Text string `json:"text"`
}

type storeJobRequest struct {
	ListId      string                      `json:"listId"`
	Title       string                      `json:"title"`
	Description string                      `json:"description"`
	AssigneeIds []string                    `json:"assigneeIds"`
	TagIds      []string                    `json:"tagIds"`
	DueAt       string                      `json:"dueAt"`
	Checklist   []storeChecklistItemRequest `json:"checklist"`
	Status      string                      `json:"status"`
}

// buildJobContext gathers everything Job JSON needs beyond the job rows
// themselves — the project's name, its lists' names, its members (assignees are
// stored as opaque RefIds) and its tags — in a fixed number of queries rather
// than per job.
func buildJobContext(projects []models.Project) (map[uint]resources.JobContext, error) {
	contexts := make(map[uint]resources.JobContext, len(projects))
	projectIds := make([]any, 0, len(projects))

	for i := range projects {
		project := &projects[i]
		projectIds = append(projectIds, project.ID)

		listNames := make(map[uint]string, len(project.Lists))
		for j := range project.Lists {
			listNames[project.Lists[j].ID] = project.Lists[j].Name
		}
		membersById := make(map[string]*models.ProjectMember, len(project.Members))
		for j := range project.Members {
			membersById[project.Members[j].RefId] = &project.Members[j]
		}

		contexts[project.ID] = resources.JobContext{
			ProjectName: project.Name,
			ListNames:   listNames,
			MembersById: membersById,
			TagsById:    map[uint]*models.ProjectTag{},
		}
	}

	if len(projectIds) == 0 {
		return contexts, nil
	}

	var tags []models.ProjectTag
	if err := facades.Orm().Query().WhereIn("project_id", projectIds).Find(&tags); err != nil {
		return nil, err
	}
	for i := range tags {
		if context, ok := contexts[tags[i].ProjectId]; ok {
			context.TagsById[tags[i].ID] = &tags[i]
		}
	}

	return contexts, nil
}

// Index — GET /api/v1/jobs. Every job across every project the caller belongs
// to. Flat rather than nested under a list because the home calendar needs a
// whole month of deadlines at once, which would otherwise be a request per list.
func (r *JobController) Index(ctx http.Context) http.Response {
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
		return ctx.Response().Success().Json([]http.Json{})
	}

	projectIds := make([]any, len(memberships))
	for i, membership := range memberships {
		projectIds[i] = membership.ProjectId
	}

	var projects []models.Project
	if err := facades.Orm().Query().With("Members").With("Lists").WhereIn("id", projectIds).Find(&projects); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	contexts, err := buildJobContext(projects)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	var jobs []models.Job
	if err := facades.Orm().Query().
		With("Assignees").
		With("Tags").
		With("Checklist").
		WhereIn("project_id", projectIds).
		OrderBy("due_at").
		Find(&jobs); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	result := make([]http.Json, 0, len(jobs))
	for i := range jobs {
		context, ok := contexts[jobs[i].ProjectId]
		if !ok {
			continue
		}
		result = append(result, resources.Job(&jobs[i], context))
	}

	return ctx.Response().Success().Json(result)
}

// Store — POST /api/v1/projects/{id}/jobs.
func (r *JobController) Store(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	project, errResp := loadProjectForMember(ctx, authUser.ID)
	if errResp != nil {
		return errResp
	}

	var request storeJobRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "invalid request body"})
	}

	title := strings.TrimSpace(request.Title)
	if title == "" {
		return ctx.Response().Status(422).Json(http.Json{"error": "title is required"})
	}

	// The list must belong to *this* project — otherwise a member of project A
	// could file a job into project B's list by id.
	var list *models.List
	for i := range project.Lists {
		if formatModelId(project.Lists[i].ID) == request.ListId {
			list = &project.Lists[i]
			break
		}
	}
	if list == nil {
		return ctx.Response().Status(422).Json(http.Json{"error": "listId does not belong to this project"})
	}

	status := request.Status
	if status == "" {
		status = models.JobStatusNotStarted
	}
	if !models.IsValidJobStatus(status) {
		return ctx.Response().Status(422).Json(http.Json{"error": "status is not one of the known job statuses"})
	}

	var dueAt *carbon.DateTime
	if trimmed := strings.TrimSpace(request.DueAt); trimmed != "" {
		parsed := carbon.Parse(trimmed)
		if parsed == nil || parsed.Error != nil {
			return ctx.Response().Status(422).Json(http.Json{"error": "dueAt must be an ISO 8601 timestamp"})
		}
		dueAt = carbon.NewDateTime(parsed)
	}

	// Assignees have to be members of this project, same reasoning as the list.
	memberIds := make(map[string]bool, len(project.Members))
	for _, member := range project.Members {
		memberIds[member.RefId] = true
	}
	for _, id := range request.AssigneeIds {
		if !memberIds[id] {
			return ctx.Response().Status(422).Json(http.Json{"error": "assignee \"" + id + "\" is not a member of this project"})
		}
	}

	// Same for tags — a job can only carry its own project's tags.
	tagIds := make([]uint, 0, len(request.TagIds))
	if len(request.TagIds) > 0 {
		var tags []models.ProjectTag
		if err := facades.Orm().Query().Where("project_id", project.ID).Find(&tags); err != nil {
			return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
		}
		byId := make(map[string]uint, len(tags))
		for i := range tags {
			byId[formatModelId(tags[i].ID)] = tags[i].ID
		}
		for _, id := range request.TagIds {
			resolved, ok := byId[id]
			if !ok {
				return ctx.Response().Status(422).Json(http.Json{"error": "tag \"" + id + "\" does not belong to this project"})
			}
			tagIds = append(tagIds, resolved)
		}
	}

	var highest models.Job
	if err := facades.Orm().Query().Where("project_id", project.ID).OrderByDesc("number").First(&highest); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	job := models.Job{
		ProjectId: project.ID,
		ListId:    list.ID,
		Number:    highest.Number + 1,
		Title:     title,
		DueAt:     dueAt,
		Status:    status,
		CreatedBy: authUser.ID,
	}
	if description := strings.TrimSpace(request.Description); description != "" {
		job.Description = &description
	}
	if err := facades.Orm().Query().Create(&job); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	if len(request.AssigneeIds) > 0 {
		assignees := make([]models.JobAssignee, 0, len(request.AssigneeIds))
		for _, id := range request.AssigneeIds {
			assignees = append(assignees, models.JobAssignee{JobId: job.ID, RefId: id})
		}
		if err := facades.Orm().Query().Create(&assignees); err != nil {
			return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
		}
		job.Assignees = assignees
	}

	if len(tagIds) > 0 {
		jobTags := make([]models.JobTag, 0, len(tagIds))
		for _, id := range tagIds {
			jobTags = append(jobTags, models.JobTag{JobId: job.ID, TagId: id})
		}
		if err := facades.Orm().Query().Create(&jobTags); err != nil {
			return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
		}
		job.Tags = jobTags
	}

	if len(request.Checklist) > 0 {
		items := make([]models.JobChecklistItem, 0, len(request.Checklist))
		for i, item := range request.Checklist {
			text := strings.TrimSpace(item.Text)
			if text == "" {
				continue
			}
			items = append(items, models.JobChecklistItem{JobId: job.ID, Text: text, Position: uint(i)})
		}
		if len(items) > 0 {
			if err := facades.Orm().Query().Create(&items); err != nil {
				return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
			}
			job.Checklist = items
		}
	}

	contexts, err := buildJobContext([]models.Project{*project})
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Status(201).Json(resources.Job(&job, contexts[project.ID]))
}
