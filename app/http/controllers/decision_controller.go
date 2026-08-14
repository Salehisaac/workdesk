package controllers

import (
	"strings"
	stdtime "time"

	"github.com/goravel/framework/contracts/http"
	"github.com/goravel/framework/support/carbon"

	"goravel/app/facades"
	"goravel/app/http/resources"
	"goravel/app/models"
)

// DecisionController handles «مصوبه» — what a session produced.
//
// Reads are flat (GET /decisions, everything across every meeting the caller was
// in) and writes are session-scoped (POST /sessions/{id}/decisions), the same
// split JobController uses: the flat read is what the home calendar and the
// مصوبات tab need, while the scoped write gives the membership check a session
// to check against.
type DecisionController struct{}

func NewDecisionController() *DecisionController {
	return &DecisionController{}
}

// decisionSessionTitles loads the titles of the sessions the given decisions
// came out of, in one query — Decision.sessionTitle is denormalized on the wire
// so the مصوبات tab can name each meeting without holding the sessions list.
func decisionSessionTitles(decisions []models.Decision) (map[uint]string, error) {
	sessionIds := make([]any, 0, len(decisions))
	seen := make(map[uint]bool, len(decisions))
	for i := range decisions {
		if decisions[i].SessionId == nil || seen[*decisions[i].SessionId] {
			continue
		}
		seen[*decisions[i].SessionId] = true
		sessionIds = append(sessionIds, *decisions[i].SessionId)
	}
	if len(sessionIds) == 0 {
		return nil, nil
	}

	var sessions []models.Session
	if err := facades.Orm().Query().WhereIn("id", sessionIds).Find(&sessions); err != nil {
		return nil, err
	}
	titles := make(map[uint]string, len(sessions))
	for i := range sessions {
		titles[sessions[i].ID] = sessions[i].Title
	}
	return titles, nil
}

// decisionAgendaTitles is the same one-query lookup for the «دستور جلسه» each
// decision came out of — Decision.agendaTitle is denormalized on the wire so the
// مصوبات tab can say which item of the running order produced a resolution
// without loading every session's agenda.
func decisionAgendaTitles(decisions []models.Decision) (map[uint]string, error) {
	agendaIds := make([]any, 0, len(decisions))
	seen := make(map[uint]bool, len(decisions))
	for i := range decisions {
		if decisions[i].AgendaId == nil || seen[*decisions[i].AgendaId] {
			continue
		}
		seen[*decisions[i].AgendaId] = true
		agendaIds = append(agendaIds, *decisions[i].AgendaId)
	}
	if len(agendaIds) == 0 {
		return nil, nil
	}

	var agendas []models.SessionAgenda
	if err := facades.Orm().Query().WhereIn("id", agendaIds).Find(&agendas); err != nil {
		return nil, err
	}
	return resources.AgendaTitles(agendas), nil
}

// Index — GET /api/v1/decisions. Every resolution from every meeting the caller
// was invited to, by due date.
//
// Scoped through session membership rather than by owner: a decision assigned to
// you in a meeting you attended is yours to see whether or not you recorded it.
func (r *DecisionController) Index(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	sessionIds, err := sessionIdsForMember(authUser.ID)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}
	if len(sessionIds) == 0 {
		return ctx.Response().Success().Json(resources.Decisions(nil, nil, nil))
	}

	var decisions []models.Decision
	if err := facades.Orm().Query().
		WhereIn("session_id", sessionIds).
		OrderBy("due_at").
		Find(&decisions); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	titles, err := decisionSessionTitles(decisions)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	agendaTitles, err := decisionAgendaTitles(decisions)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Success().Json(resources.Decisions(decisions, titles, agendaTitles))
}

type storeDecisionRequest struct {
	Title string `json:"title"`
	// The resolution's own text, under its one-line title. Optional.
	Description string `json:"description"`
	// RFC 3339 — the «سررسید», picked on the Jalali calendar. Time-of-day is
	// accepted and stored; the session screen shows it alongside the day.
	DueAt string `json:"dueAt"`
	// Which «دستور جلسه» of this session it came out of. Optional — a room
	// decides things nobody put on the running order.
	AgendaId string `json:"agendaId"`
	// One of the session's members, by their picked-item id. Optional: a
	// resolution the room owns collectively has no single assignee.
	AssigneeId string `json:"assigneeId"`
}

// Store — POST /api/v1/sessions/{id}/decisions. The meeting's owner alone
// (loadSessionForOwner): a مصوبه is the record of what the room agreed, and the
// person who convened it keeps that record.
//
// The assignee must be someone who was in the meeting. That isn't bureaucracy:
// the name is denormalized from the member row, so accepting an arbitrary id
// would store a display name nothing can ever correct.
func (r *DecisionController) Store(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	session, errResp := loadSessionForOwner(ctx, authUser.ID)
	if errResp != nil {
		return errResp
	}

	var request storeDecisionRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "invalid request body"})
	}

	title := strings.TrimSpace(request.Title)
	if title == "" {
		return ctx.Response().Status(422).Json(http.Json{"error": "title is required"})
	}

	dueAt, err := stdtime.Parse(stdtime.RFC3339, strings.TrimSpace(request.DueAt))
	if err != nil {
		return ctx.Response().Status(422).Json(http.Json{"error": "dueAt must be an RFC 3339 timestamp"})
	}

	decision := models.Decision{
		SessionId:  &session.ID,
		OwnerRefId: authUser.ID,
		Title:      title,
		DueAt:      carbon.NewDateTime(carbon.FromStdTime(dueAt)),
		Status:     models.DecisionStatusOpen,
	}
	if description := strings.TrimSpace(request.Description); description != "" {
		decision.Description = &description
	}

	// The agenda item must belong to *this* meeting. Checked rather than trusted
	// for the same reason the assignee is: agendaTitle is denormalized on the
	// wire, and pointing a resolution at another session's running order would
	// label it with a heading nobody in this room ever saw.
	agendaTitles := map[uint]string{}
	if rawAgendaId := strings.TrimSpace(request.AgendaId); rawAgendaId != "" {
		agendaId, ok := parseRouteId(rawAgendaId)
		if !ok {
			return ctx.Response().Status(422).Json(http.Json{"error": "agendaId is not an agenda item of this session"})
		}

		var agenda models.SessionAgenda
		if err := facades.Orm().Query().Where("id", agendaId).Where("session_id", session.ID).First(&agenda); err != nil {
			return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
		}
		if agenda.ID == 0 {
			return ctx.Response().Status(422).Json(http.Json{"error": "agendaId is not an agenda item of this session"})
		}

		decision.AgendaId = &agenda.ID
		agendaTitles[agenda.ID] = agenda.Title
	}

	if assigneeId := strings.TrimSpace(request.AssigneeId); assigneeId != "" {
		assignee := sessionMemberByRef(session, assigneeId)
		if assignee == nil {
			return ctx.Response().Status(422).Json(http.Json{"error": "assigneeId is not a member of this session"})
		}
		decision.AssigneeRefId = &assignee.RefId
		decision.AssigneeName = &assignee.DisplayName
	}

	if err := facades.Orm().Query().Create(&decision); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Status(201).Json(
		resources.Decision(&decision, map[uint]string{session.ID: session.Title}, agendaTitles),
	)
}

type updateDecisionRequest struct {
	Status string `json:"status"`
}

// Update — PATCH /api/v1/decisions/{id}. Status only, for the same reason a
// session's PATCH is: the text of a resolution is the record of what a room
// agreed, and moving it between open/done/canceled is the only part that is
// supposed to change after the meeting.
func (r *DecisionController) Update(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	id, ok := parseRouteId(ctx.Request().Route("id"))
	if !ok {
		return ctx.Response().Status(404).Json(http.Json{"error": "decision not found"})
	}

	var decision models.Decision
	if err := facades.Orm().Query().Where("id", id).First(&decision); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}
	if decision.ID == 0 {
		return ctx.Response().Status(404).Json(http.Json{"error": "decision not found"})
	}

	// The two people a resolution is actually about: whoever is to carry it out
	// («مسئول»), and whoever recorded it — which, since only a meeting's owner
	// may record one, is that owner.
	//
	// Narrower than it was. Any member of the room could mark any resolution
	// done, which made «انجام شد» a claim anybody could make about somebody
	// else's commitment. The owner is still checked separately, for rows written
	// back when any member could record them, and for a resolution whose meeting
	// has since been deleted (session_id goes null, not away).
	allowed := decision.OwnerRefId == authUser.ID ||
		(decision.AssigneeRefId != nil && *decision.AssigneeRefId == authUser.ID)

	if !allowed && decision.SessionId != nil {
		var session models.Session
		if err := facades.Orm().Query().Where("id", *decision.SessionId).First(&session); err != nil {
			return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
		}
		allowed = session.ID != 0 && session.OwnerRefId == authUser.ID
	}

	if !allowed {
		return ctx.Response().Status(403).Json(http.Json{"error": "only the person responsible for this decision, or the meeting's owner, can change it"})
	}

	var request updateDecisionRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "invalid request body"})
	}

	status := strings.TrimSpace(request.Status)
	if !containsString(models.DecisionStatuses, status) {
		return ctx.Response().Status(422).Json(http.Json{"error": "status must be one of " + strings.Join(models.DecisionStatuses, ", ")})
	}

	decision.Status = status
	if err := facades.Orm().Query().Save(&decision); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	titles, err := decisionSessionTitles([]models.Decision{decision})
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	agendaTitles, err := decisionAgendaTitles([]models.Decision{decision})
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Success().Json(resources.Decision(&decision, titles, agendaTitles))
}
