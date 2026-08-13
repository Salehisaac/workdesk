package controllers

import (
	"strconv"
	"strings"
	stdtime "time"

	"github.com/goravel/framework/contracts/http"
	"github.com/goravel/framework/support/carbon"

	"goravel/app/facades"
	"goravel/app/http/resources"
	"goravel/app/models"
	"goravel/app/services/sessioninvite"
)

// SessionController handles «جلسه» — the meeting repository's unit.
//
// Read Store beside ProjectController.Store: the two flows are deliberately the
// same shape (a title, a picked member list, the creator as owner) and differ in
// exactly one step. A project provisions a Rasagram supergroup and the group
// appearing in everyone's chat list IS the invitation. A session provisions
// nothing, so its members are told by a direct message carrying a deep link back
// into the mini app (app/services/sessioninvite). Everything else here follows
// the project module's conventions.
type SessionController struct{}

func NewSessionController() *SessionController {
	return &SessionController{}
}

// loadSessionForMember loads a session by its {id} route param and verifies the
// given user is a member of it — the session-level equivalent of
// loadProjectForMember. Returns a written response on any failure.
func loadSessionForMember(ctx http.Context, userId string) (*models.Session, http.Response) {
	id, ok := parseRouteId(ctx.Request().Route("id"))
	if !ok {
		return nil, ctx.Response().Status(404).Json(http.Json{"error": "session not found"})
	}

	var session models.Session
	if err := facades.Orm().Query().With("Members").Where("id", id).First(&session); err != nil {
		return nil, ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}
	if session.ID == 0 {
		return nil, ctx.Response().Status(404).Json(http.Json{"error": "session not found"})
	}

	for _, member := range session.Members {
		if member.RefId == userId && member.RefSource == "users" {
			return &session, nil
		}
	}
	// The owner is always stored as a member, so reaching here really does mean
	// "not invited" rather than "created it but isn't in the list".
	return nil, ctx.Response().Status(403).Json(http.Json{"error": "not a member of this session"})
}

// sessionIdsForMember is every session the given user was invited to. Returned
// as []any so it can go straight into WhereIn.
func sessionIdsForMember(userId string) ([]any, error) {
	var memberships []models.SessionMember
	if err := facades.Orm().Query().
		Where("ref_id", userId).
		Where("ref_source", "users").
		Find(&memberships); err != nil {
		return nil, err
	}

	ids := make([]any, 0, len(memberships))
	seen := make(map[uint]bool, len(memberships))
	for i := range memberships {
		if seen[memberships[i].SessionId] {
			continue
		}
		seen[memberships[i].SessionId] = true
		ids = append(ids, memberships[i].SessionId)
	}
	return ids, nil
}

// sessionProjectNames loads the names of every project the given sessions are
// filed under, in one query rather than one per session — the same shape
// noteProjectNames has, for the same reason (Session.projectName is
// denormalized on the wire).
func sessionProjectNames(sessions []models.Session) (map[uint]string, error) {
	projectIds := make([]any, 0, len(sessions))
	seen := make(map[uint]bool, len(sessions))
	for i := range sessions {
		if sessions[i].ProjectId == nil || seen[*sessions[i].ProjectId] {
			continue
		}
		seen[*sessions[i].ProjectId] = true
		projectIds = append(projectIds, *sessions[i].ProjectId)
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

// Index — GET /api/v1/sessions.
//
// Every session the caller was invited to, soonest first. Flat and unfiltered
// for the same reason GET /jobs and GET /notes are: the home calendar indexes
// by day itself, so one request beats one per day tapped.
func (r *SessionController) Index(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	sessionIds, err := sessionIdsForMember(authUser.ID)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}
	if len(sessionIds) == 0 {
		return ctx.Response().Success().Json(resources.Sessions(nil, nil))
	}

	var sessions []models.Session
	if err := facades.Orm().Query().
		With("Members").
		WhereIn("id", sessionIds).
		OrderBy("starts_at").
		Find(&sessions); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	projectNames, err := sessionProjectNames(sessions)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Success().Json(resources.Sessions(sessions, projectNames))
}

// Show — GET /api/v1/sessions/{id}. The session, its members, its running order
// («دستورات جلسه») and the decisions taken in it, in one response — everything
// the session screen renders.
func (r *SessionController) Show(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	session, errResp := loadSessionForMember(ctx, authUser.ID)
	if errResp != nil {
		return errResp
	}

	projectNames, err := sessionProjectNames([]models.Session{*session})
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	agendas, err := sessionAgendas(session.ID)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	var decisions []models.Decision
	if err := facades.Orm().Query().
		Where("session_id", session.ID).
		OrderBy("due_at").
		Find(&decisions); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Success().Json(
		resources.SessionDetail(session, projectNames, agendas, decisions, map[uint]string{session.ID: session.Title}),
	)
}

type storeSessionRequest struct {
	Title string `json:"title"`
	// RFC 3339 with the device's own offset (see the frontend's toLocalIso) — the
	// invite message renders the Persian wall clock from it.
	StartsAt string `json:"startsAt"`
	Location string `json:"location"`
	IsOnline bool   `json:"isOnline"`
	// Optional filing under a project the caller belongs to.
	ProjectId string                   `json:"projectId"`
	Members   []storePickedItemRequest `json:"members"`
}

// Store — POST /api/v1/sessions.
//
// Creates the meeting, records who is in it, then messages each of them a link
// that opens the mini app on this session. Sending is best-effort by design: a
// member who has never started the bot has no chat to receive it, and refusing
// to create the meeting over that would make the module unusable for exactly the
// people it most needs to reach. Who was actually notified comes back in the
// response (members[].notifiedAt), so the screen can say so.
func (r *SessionController) Store(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	var request storeSessionRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "invalid request body"})
	}

	title := strings.TrimSpace(request.Title)
	if title == "" {
		return ctx.Response().Status(422).Json(http.Json{"error": "title is required"})
	}

	startsAt, err := stdtime.Parse(stdtime.RFC3339, strings.TrimSpace(request.StartsAt))
	if err != nil {
		return ctx.Response().Status(422).Json(http.Json{"error": "startsAt must be an RFC 3339 timestamp"})
	}

	// resolveNoteProject is the note module's, but the rule it enforces is the
	// same one a session needs: you may only file under a project you belong to.
	projectId, errResp := resolveNoteProject(ctx, request.ProjectId, authUser.ID)
	if errResp != nil {
		return errResp
	}

	session := models.Session{
		OwnerRefId: authUser.ID,
		Title:      title,
		ProjectId:  projectId,
		StartsAt:   carbon.NewDateTime(carbon.FromStdTime(startsAt)),
		IsOnline:   request.IsOnline,
		Status:     models.SessionStatusNotStarted,
	}
	// A location is meaningless once the meeting is online, so it isn't stored —
	// otherwise flipping the switch would leave a stale room name behind that
	// the resource layer has to keep remembering to hide.
	if location := strings.TrimSpace(request.Location); location != "" && !request.IsOnline {
		session.Location = &location
	}
	if err := facades.Orm().Query().Create(&session); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	displayName := strings.TrimSpace(authUser.FirstName + " " + authUser.LastName)
	members := []models.SessionMember{
		{SessionId: session.ID, RefId: authUser.ID, RefSource: "users", DisplayName: displayName, Online: true, Role: models.SessionMemberRoleOwner},
	}
	for _, member := range request.Members {
		// The creator is added as owner above; a picker that also returned them
		// must not produce a second row (and a second invite).
		if member.Id == authUser.ID && member.Source == "users" {
			continue
		}
		members = append(members, models.SessionMember{
			SessionId:   session.ID,
			RefId:       member.Id,
			RefSource:   member.Source,
			DisplayName: member.DisplayName,
			Username:    member.Username,
			Phone:       member.Phone,
			Online:      member.Online,
			Role:        models.SessionMemberRoleMember,
		})
	}

	// Sent before the insert so each row is written once, already carrying
	// whether its invite arrived — rather than inserted, messaged, and updated.
	sessioninvite.Send(&session, members)

	if err := facades.Orm().Query().Create(&members); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}
	session.Members = members

	projectNames, err := sessionProjectNames([]models.Session{session})
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	// No agendas and no decisions yet by construction — both are written on the
	// session screen this response redirects to.
	return ctx.Response().Status(201).Json(
		resources.SessionDetail(&session, projectNames, nil, nil, nil),
	)
}

type updateSessionRequest struct {
	Status string `json:"status"`
}

// Update — PATCH /api/v1/sessions/{id}. Status only.
//
// Nothing else about a meeting is editable here on purpose: title, time and
// place are what the invite message already told everyone, and silently changing
// them would leave every member holding a message that is now wrong. Status is
// the one field whose whole job is to change afterwards.
func (r *SessionController) Update(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	session, errResp := loadSessionForMember(ctx, authUser.ID)
	if errResp != nil {
		return errResp
	}

	var request updateSessionRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "invalid request body"})
	}

	status := strings.TrimSpace(request.Status)
	if !containsString(models.SessionStatuses, status) {
		return ctx.Response().Status(422).Json(http.Json{"error": "status must be one of " + strings.Join(models.SessionStatuses, ", ")})
	}

	session.Status = status
	if err := facades.Orm().Query().Save(session); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	projectNames, err := sessionProjectNames([]models.Session{*session})
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Success().Json(resources.Session(session, projectNames))
}

// containsString is the membership test the status validators need. Written out
// rather than pulled from slices.Contains only because both callers want the
// same error message built from the same slice.
func containsString(values []string, value string) bool {
	for _, candidate := range values {
		if candidate == value {
			return true
		}
	}
	return false
}

// parseRouteId reads a session id out of a route param. Parsed rather than
// handed to Find() as a string: the ORM reads a non-numeric one as a raw SQL
// condition (see resolveNoteProject for the same care).
func parseRouteId(raw string) (uint, bool) {
	parsed, err := strconv.ParseUint(strings.TrimSpace(raw), 10, 64)
	if err != nil || parsed == 0 {
		return 0, false
	}
	return uint(parsed), true
}
