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

// resolveList finds the list an id names, insisting it belongs to THIS
// project — otherwise a member of project A could file a job into project B's
// list just by knowing its id.
func resolveList(ctx http.Context, project *models.Project, listId string) (*models.List, http.Response) {
	for i := range project.Lists {
		if formatModelId(project.Lists[i].ID) == listId {
			return &project.Lists[i], nil
		}
	}
	return nil, ctx.Response().Status(422).Json(http.Json{"error": "listId does not belong to this project"})
}

// parseDueAt turns the wire's ISO 8601 string into a stored timestamp. An
// empty/blank string means "no deadline" and yields nil, which is also how a
// caller clears one.
func parseDueAt(ctx http.Context, raw string) (*carbon.DateTime, http.Response) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
	}

	parsed := carbon.Parse(trimmed)
	if parsed == nil || parsed.Error != nil {
		return nil, ctx.Response().Status(422).Json(http.Json{"error": "dueAt must be an ISO 8601 timestamp"})
	}
	return carbon.NewDateTime(parsed), nil
}

// validateAssignees insists every assignee is a member of this project — same
// reasoning as resolveList.
func validateAssignees(ctx http.Context, project *models.Project, ids []string) http.Response {
	memberIds := make(map[string]bool, len(project.Members))
	for _, member := range project.Members {
		memberIds[member.RefId] = true
	}
	for _, id := range ids {
		if !memberIds[id] {
			return ctx.Response().Status(422).Json(http.Json{"error": "assignee \"" + id + "\" is not a member of this project"})
		}
	}
	return nil
}

// resolveTagIds maps the wire's tag ids to rows, insisting each one is this
// project's own — a job can only carry tags from its project's pool.
func resolveTagIds(ctx http.Context, project *models.Project, ids []string) ([]uint, http.Response) {
	tagIds := make([]uint, 0, len(ids))
	if len(ids) == 0 {
		return tagIds, nil
	}

	var tags []models.ProjectTag
	if err := facades.Orm().Query().Where("project_id", project.ID).Find(&tags); err != nil {
		return nil, ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}
	byId := make(map[string]uint, len(tags))
	for i := range tags {
		byId[formatModelId(tags[i].ID)] = tags[i].ID
	}
	for _, id := range ids {
		resolved, ok := byId[id]
		if !ok {
			return nil, ctx.Response().Status(422).Json(http.Json{"error": "tag \"" + id + "\" does not belong to this project"})
		}
		tagIds = append(tagIds, resolved)
	}
	return tagIds, nil
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

	// `id` is not decoration: due_at alone is a PARTIAL order, and most jobs
	// have no deadline at all, so every one of them ties. SQL guarantees
	// nothing about the order of ties, which left the board free to reshuffle
	// untouched cards whenever anything was written — editing a job appeared
	// to send it to the bottom of its list. Ordering by the row's own id after
	// due_at makes it total, so a card only ever moves when its deadline
	// actually changes, and otherwise stays in creation order.
	var jobs []models.Job
	if err := facades.Orm().Query().
		With("Assignees").
		With("Tags").
		With("Checklist").
		WhereIn("project_id", projectIds).
		OrderBy("due_at").
		OrderBy("id").
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

	list, errResp := resolveList(ctx, project, request.ListId)
	if errResp != nil {
		return errResp
	}

	status := request.Status
	if status == "" {
		status = models.JobStatusNotStarted
	}
	if !models.IsValidJobStatus(status) {
		return ctx.Response().Status(422).Json(http.Json{"error": "status is not one of the known job statuses"})
	}

	dueAt, errResp := parseDueAt(ctx, request.DueAt)
	if errResp != nil {
		return errResp
	}

	if errResp := validateAssignees(ctx, project, request.AssigneeIds); errResp != nil {
		return errResp
	}

	tagIds, errResp := resolveTagIds(ctx, project, request.TagIds)
	if errResp != nil {
		return errResp
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

type updateChecklistItemRequest struct {
	Text string `json:"text"`
	Done bool   `json:"done"`
}

// updateJobRequest is PATCH-shaped: every field is a pointer, and only the
// ones actually PRESENT in the body are touched. That is what lets the edit
// form send the whole job while a future caller can flip one thing — a status
// from the board, a checklist item from a card — without having to resend
// (and risk clobbering) everything else.
//
// Present-but-empty is a real value, and the distinction matters:
//   - "dueAt": ""      clears the deadline;  omitted leaves it alone
//   - "assigneeIds": [] removes every assignee; omitted leaves them alone
//
// A JSON null reads the same as omitted, since it unmarshals a pointer back to
// nil — so use the empty value to clear, never null.
type updateJobRequest struct {
	ListId      *string                       `json:"listId"`
	Title       *string                       `json:"title"`
	Description *string                       `json:"description"`
	AssigneeIds *[]string                     `json:"assigneeIds"`
	TagIds      *[]string                     `json:"tagIds"`
	DueAt       *string                       `json:"dueAt"`
	Checklist   *[]updateChecklistItemRequest `json:"checklist"`
	Status      *string                       `json:"status"`
}

// Update — PATCH /api/v1/projects/{id}/jobs/{jobId}.
//
// Project-scoped rather than a flat /jobs/{id} so the caller's membership is
// checked against the same project the job must belong to, in one step, the
// way every other write in this file is (loadProjectForMember).
//
// `number` and `createdBy` are deliberately not editable: the first is a
// per-project sequence the backend owns, the second is a record of who filed
// the job, which editing it should not rewrite.
func (r *JobController) Update(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	project, errResp := loadProjectForMember(ctx, authUser.ID)
	if errResp != nil {
		return errResp
	}

	// Scoped to the project, so a job id from another project reads as "not
	// found" here rather than being edited across the boundary.
	var job models.Job
	if err := facades.Orm().Query().
		With("Assignees").
		With("Tags").
		With("Checklist").
		Where("project_id", project.ID).
		Find(&job, ctx.Request().Route("jobId")); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}
	if job.ID == 0 {
		return ctx.Response().Status(404).Json(http.Json{"error": "job not found"})
	}

	var request updateJobRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "invalid request body"})
	}

	if request.Title != nil {
		title := strings.TrimSpace(*request.Title)
		if title == "" {
			return ctx.Response().Status(422).Json(http.Json{"error": "title is required"})
		}
		job.Title = title
	}

	if request.ListId != nil {
		list, errResp := resolveList(ctx, project, *request.ListId)
		if errResp != nil {
			return errResp
		}
		job.ListId = list.ID
	}

	if request.Status != nil {
		if !models.IsValidJobStatus(*request.Status) {
			return ctx.Response().Status(422).Json(http.Json{"error": "status is not one of the known job statuses"})
		}
		job.Status = *request.Status
	}

	if request.Description != nil {
		if description := strings.TrimSpace(*request.Description); description != "" {
			job.Description = &description
		} else {
			job.Description = nil
		}
	}

	if request.DueAt != nil {
		dueAt, errResp := parseDueAt(ctx, *request.DueAt)
		if errResp != nil {
			return errResp
		}
		job.DueAt = dueAt
	}

	// Everything is validated before ANY of it is written, so a request that
	// fails halfway through validation leaves the job exactly as it was.
	var tagIds []uint
	if request.TagIds != nil {
		tagIds, errResp = resolveTagIds(ctx, project, *request.TagIds)
		if errResp != nil {
			return errResp
		}
	}
	if request.AssigneeIds != nil {
		if errResp := validateAssignees(ctx, project, *request.AssigneeIds); errResp != nil {
			return errResp
		}
	}

	if err := facades.Orm().Query().Save(&job); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	// The child collections are replaced wholesale rather than diffed. They are
	// small, unordered sets (assignees, tags) or an ordered list whose order is
	// itself part of the edit (checklist), and a diff would buy nothing but
	// stable row ids — which nothing here refers to across a request, since the
	// response is rebuilt from what was just written.
	if request.AssigneeIds != nil {
		if _, err := facades.Orm().Query().Where("job_id", job.ID).Delete(&models.JobAssignee{}); err != nil {
			return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
		}
		assignees := make([]models.JobAssignee, 0, len(*request.AssigneeIds))
		for _, id := range *request.AssigneeIds {
			assignees = append(assignees, models.JobAssignee{JobId: job.ID, RefId: id})
		}
		if len(assignees) > 0 {
			if err := facades.Orm().Query().Create(&assignees); err != nil {
				return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
			}
		}
		job.Assignees = assignees
	}

	if request.TagIds != nil {
		if _, err := facades.Orm().Query().Where("job_id", job.ID).Delete(&models.JobTag{}); err != nil {
			return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
		}
		jobTags := make([]models.JobTag, 0, len(tagIds))
		for _, id := range tagIds {
			jobTags = append(jobTags, models.JobTag{JobId: job.ID, TagId: id})
		}
		if len(jobTags) > 0 {
			if err := facades.Orm().Query().Create(&jobTags); err != nil {
				return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
			}
		}
		job.Tags = jobTags
	}

	if request.Checklist != nil {
		if _, err := facades.Orm().Query().Where("job_id", job.ID).Delete(&models.JobChecklistItem{}); err != nil {
			return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
		}
		items := make([]models.JobChecklistItem, 0, len(*request.Checklist))
		for _, item := range *request.Checklist {
			text := strings.TrimSpace(item.Text)
			if text == "" {
				continue
			}
			// Position comes from the surviving items' order, not the request
			// index, so dropping a blank row doesn't leave a gap in it.
			items = append(items, models.JobChecklistItem{
				JobId:    job.ID,
				Text:     text,
				Done:     item.Done,
				Position: uint(len(items)),
			})
		}
		if len(items) > 0 {
			if err := facades.Orm().Query().Create(&items); err != nil {
				return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
			}
		}
		job.Checklist = items
	}

	contexts, err := buildJobContext([]models.Project{*project})
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Success().Json(resources.Job(&job, contexts[project.ID]))
}
