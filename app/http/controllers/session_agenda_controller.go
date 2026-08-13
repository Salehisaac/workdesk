package controllers

import (
	"strings"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
	"goravel/app/http/resources"
	"goravel/app/models"
)

// SessionAgendaController handles «دستور جلسه» — the meeting's running order.
//
// Writes only, and session-scoped like DecisionController.Store: the running
// order is read as part of the session it belongs to (GET /sessions/{id} carries
// `agendas`), because an agenda item outside its meeting is a sentence with no
// subject — unlike a مصوبه, which is a commitment somebody owes whether or not
// the meeting it came from is on screen.
type SessionAgendaController struct{}

func NewSessionAgendaController() *SessionAgendaController {
	return &SessionAgendaController{}
}

// sessionAgendas loads a session's running order in the order it was written.
// By id, not by duration or title: an agenda is a sequence, and the sequence is
// the order the room will go through it in.
func sessionAgendas(sessionId uint) ([]models.SessionAgenda, error) {
	var agendas []models.SessionAgenda
	if err := facades.Orm().Query().
		Where("session_id", sessionId).
		OrderBy("id").
		Find(&agendas); err != nil {
		return nil, err
	}
	return agendas, nil
}

// sessionMemberByRef finds a picked-item id among a session's members. Both a
// decision's «مسئول اجرایی» and an agenda item's have to be someone who was in
// the room, for the same reason: the display name is denormalized off the member
// row, so an arbitrary id would store a name nothing could ever correct.
func sessionMemberByRef(session *models.Session, refId string) *models.SessionMember {
	for i := range session.Members {
		if session.Members[i].RefId == refId {
			return &session.Members[i]
		}
	}
	return nil
}

type storeAgendaRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	// Minutes — the hour and minute columns of the picker, already summed. Zero
	// and absent mean the same thing (nobody budgeted this item), because an
	// agenda item scheduled to take no time is not a thing anyone means.
	DurationMinutes int `json:"durationMinutes"`
	// One of the session's members, by their picked-item id. Optional.
	AssigneeId string `json:"assigneeId"`
}

// Store — POST /api/v1/sessions/{id}/agendas.
//
// Any member may add to the running order, matching how any member may record
// what the room decided. The meeting is the unit of authorization here; there is
// no separate notion of who "owns" the agenda.
func (r *SessionAgendaController) Store(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	session, errResp := loadSessionForMember(ctx, authUser.ID)
	if errResp != nil {
		return errResp
	}

	var request storeAgendaRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "invalid request body"})
	}

	title := strings.TrimSpace(request.Title)
	if title == "" {
		return ctx.Response().Status(422).Json(http.Json{"error": "title is required"})
	}

	if request.DurationMinutes < 0 || request.DurationMinutes > models.AgendaMaxDurationMinutes {
		return ctx.Response().Status(422).Json(http.Json{"error": "durationMinutes must be between 0 and 1439"})
	}

	agenda := models.SessionAgenda{
		SessionId:  session.ID,
		OwnerRefId: authUser.ID,
		Title:      title,
	}
	if description := strings.TrimSpace(request.Description); description != "" {
		agenda.Description = &description
	}
	if request.DurationMinutes > 0 {
		duration := uint(request.DurationMinutes)
		agenda.DurationMinutes = &duration
	}

	if assigneeId := strings.TrimSpace(request.AssigneeId); assigneeId != "" {
		assignee := sessionMemberByRef(session, assigneeId)
		if assignee == nil {
			return ctx.Response().Status(422).Json(http.Json{"error": "assigneeId is not a member of this session"})
		}
		agenda.AssigneeRefId = &assignee.RefId
		agenda.AssigneeName = &assignee.DisplayName
	}

	if err := facades.Orm().Query().Create(&agenda); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Status(201).Json(resources.SessionAgenda(&agenda))
}
