package controllers

import (
	"strconv"
	"strings"
	"time"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
	"goravel/app/http/resources"
	"goravel/app/models"
)

// NoteController handles «یادداشت» — the smallest thing WorkDesk stores. A note
// is private to whoever wrote it (like a Reminder, unlike everything project
// shaped), and it belongs to exactly one calendar day: the day it was written
// on. That last part is a rule, not a default — see Store.
type NoteController struct{}

func NewNoteController() *NoteController {
	return &NoteController{}
}

type storeNoteRequest struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	// Optional filing under a project the caller belongs to.
	ProjectId string `json:"projectId"`
	// The day the client believes it is writing on, RFC 3339 with the device's
	// own offset (see toLocalIso). Checked, never stored — see requireToday.
	Date string `json:"date"`
}

// requireToday enforces the one rule a note has: it can only be written for the
// day it is being written on. Nothing here can backdate a note anyway —
// created_at is set by the insert — so the check exists to *tell* the client,
// rather than silently filing yesterday's note under today.
//
// A blank date means the client made no claim about the day, which is fine: the
// row still lands on today.
func requireToday(ctx http.Context, raw string) http.Response {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}

	claimed, err := time.Parse(time.RFC3339, trimmed)
	if err != nil {
		return ctx.Response().Status(422).Json(http.Json{"error": "date must be an RFC 3339 timestamp"})
	}
	if !isToday(claimed, time.Now()) {
		return ctx.Response().Status(422).Json(http.Json{"error": "a note can only be created for the current day"})
	}
	return nil
}

// isToday reports whether `claimed` names the same calendar day as `now`.
//
// Judged in the offset `claimed` carries, not the server's zone: a calendar day
// is whatever the user's own wall clock calls it, and a fixed server zone would
// reject a legitimate "today" for anyone writing from outside it. Comparing the
// Gregorian y/m/d is the same test as comparing the Jalali one the user sees —
// both calendars roll over at the same local midnight.
func isToday(claimed, now time.Time) bool {
	claimedYear, claimedMonth, claimedDay := claimed.Date()
	nowYear, nowMonth, nowDay := now.In(claimed.Location()).Date()
	return claimedYear == nowYear && claimedMonth == nowMonth && claimedDay == nowDay
}

// resolveNoteProject maps the wire's projectId to a project the caller may file
// under. Blank means "not filed under a project", which is the common case.
func resolveNoteProject(ctx http.Context, raw string, userId string) (*uint, http.Response) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
	}

	// Parsed rather than passed to Find() as an id, because this one arrives in
	// the request body: the ORM reads a non-numeric string as a raw SQL
	// condition, so "1=1" would otherwise reach the database as one.
	parsed, err := strconv.ParseUint(trimmed, 10, 64)
	if err != nil {
		return nil, ctx.Response().Status(422).Json(http.Json{"error": "projectId must be a project id"})
	}

	var project models.Project
	if err := facades.Orm().Query().With("Members").Where("id", uint(parsed)).First(&project); err != nil {
		return nil, ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}
	if project.ID == 0 {
		return nil, ctx.Response().Status(422).Json(http.Json{"error": "projectId does not exist"})
	}
	for _, member := range project.Members {
		if member.RefId == userId && member.RefSource == "users" {
			id := project.ID
			return &id, nil
		}
	}
	// 422 rather than 403: the project is a field of the note being written,
	// not the resource being addressed.
	return nil, ctx.Response().Status(422).Json(http.Json{"error": "not a member of this project"})
}

// noteProjectNames loads the names of every project the given notes are filed
// under, in one query rather than one per note.
func noteProjectNames(notes []models.Note) (map[uint]string, error) {
	projectIds := make([]any, 0, len(notes))
	seen := make(map[uint]bool, len(notes))
	for i := range notes {
		if notes[i].ProjectId == nil || seen[*notes[i].ProjectId] {
			continue
		}
		seen[*notes[i].ProjectId] = true
		projectIds = append(projectIds, *notes[i].ProjectId)
	}
	if len(projectIds) == 0 {
		return nil, nil
	}

	var projects []models.Project
	if err := facades.Orm().Query().WhereIn("id", projectIds).Find(&projects); err != nil {
		return nil, err
	}
	names := make(map[uint]string, len(projects))
	for i := range projects {
		names[projects[i].ID] = projects[i].Name
	}
	return names, nil
}

// Index — GET /api/v1/notes. The caller's own notes, newest first.
//
// Flat and unfiltered, for the same reason GET /jobs is: the home calendar
// indexes everything by day itself, so one request beats one per day tapped.
func (r *NoteController) Index(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	var notes []models.Note
	if err := facades.Orm().Query().
		Where("owner_ref_id", authUser.ID).
		OrderByDesc("created_at").
		Find(&notes); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	projectNames, err := noteProjectNames(notes)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Success().Json(resources.Notes(notes, projectNames))
}

// Store — POST /api/v1/notes.
//
// Writes the note against today and stops there. A note sends no message and
// has no schedule; the day dashboard picks it up on the day it was written.
func (r *NoteController) Store(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	var request storeNoteRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "invalid request body"})
	}

	title := strings.TrimSpace(request.Title)
	if title == "" {
		return ctx.Response().Status(422).Json(http.Json{"error": "title is required"})
	}
	if errResp := requireToday(ctx, request.Date); errResp != nil {
		return errResp
	}

	projectId, errResp := resolveNoteProject(ctx, request.ProjectId, authUser.ID)
	if errResp != nil {
		return errResp
	}

	note := models.Note{
		OwnerRefId: authUser.ID,
		Title:      title,
		ProjectId:  projectId,
	}
	if body := strings.TrimSpace(request.Body); body != "" {
		note.Body = &body
	}
	if err := facades.Orm().Query().Create(&note); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	projectNames, err := noteProjectNames([]models.Note{note})
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Status(201).Json(resources.Note(&note, projectNames))
}
