package resources

import (
	"github.com/goravel/framework/contracts/http"

	"goravel/app/models"
)

// ProjectTag matches the `JobTag` shape the frontend expects.
func ProjectTag(t *models.ProjectTag) http.Json {
	return http.Json{
		"id":        formatId(t.ID),
		"projectId": formatId(t.ProjectId),
		"name":      t.Name,
		"color":     t.Color,
	}
}

func ProjectTags(tags []models.ProjectTag) []http.Json {
	result := make([]http.Json, len(tags))
	for i := range tags {
		result[i] = ProjectTag(&tags[i])
	}
	return result
}

func JobChecklistItems(items []models.JobChecklistItem) []http.Json {
	result := make([]http.Json, len(items))
	for i := range items {
		result[i] = http.Json{
			"id":   formatId(items[i].ID),
			"text": items[i].Text,
			"done": items[i].Done,
		}
	}
	return result
}

// JobContext carries the denormalized names and the lookup tables a Job's JSON
// needs but the row itself doesn't hold: assignees are stored as opaque RefIds
// (resolved against the project's members) and tags as pivot rows (resolved
// against the project's tag pool).
type JobContext struct {
	ProjectName string
	ListNames   map[uint]string
	MembersById map[string]*models.ProjectMember
	TagsById    map[uint]*models.ProjectTag
}

// Job matches the `Job` shape in the frontend's modules/project/types.ts.
func Job(j *models.Job, ctx JobContext) http.Json {
	assignees := make([]http.Json, 0, len(j.Assignees))
	for i := range j.Assignees {
		if member, ok := ctx.MembersById[j.Assignees[i].RefId]; ok {
			assignees = append(assignees, ProjectMember(member))
		}
	}

	tags := make([]http.Json, 0, len(j.Tags))
	for i := range j.Tags {
		if tag, ok := ctx.TagsById[j.Tags[i].TagId]; ok {
			tags = append(tags, ProjectTag(tag))
		}
	}

	var dueAt any
	if j.DueAt != nil {
		dueAt = j.DueAt.ToRfc3339String()
	}
	var createdAt string
	if j.CreatedAt != nil {
		createdAt = j.CreatedAt.ToRfc3339String()
	}

	var listName any
	if name, ok := ctx.ListNames[j.ListId]; ok {
		listName = name
	}

	return http.Json{
		"id":          formatId(j.ID),
		"number":      j.Number,
		"title":       j.Title,
		"description": j.Description,
		"listId":      formatId(j.ListId),
		"listName":    listName,
		"projectId":   formatId(j.ProjectId),
		"projectName": ctx.ProjectName,
		"dueAt":       dueAt,
		"assignees":   assignees,
		"tags":        tags,
		"checklist":   JobChecklistItems(j.Checklist),
		"status":      j.Status,
		"createdAt":   createdAt,
	}
}
