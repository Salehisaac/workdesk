package resources

import (
	"github.com/goravel/framework/contracts/http"

	"goravel/app/models"
)

// Session matches the `Session` shape in the frontend's modules/meeting/types.ts.
//
// projectName is denormalized on purpose — the agenda labels a session with the
// project it belongs to, and making it join client-side would mean the home
// calendar can't render a session until /projects has also arrived. Callers pass
// the names they already loaded (see sessionProjectNames); an unknown id renders
// as null rather than an empty string, which is what "no project" looks like.
func Session(s *models.Session, projectNames map[uint]string) http.Json {
	var startsAt string
	if s.StartsAt != nil {
		startsAt = s.StartsAt.ToRfc3339String()
	}

	var projectId, projectName any
	if s.ProjectId != nil {
		projectId = formatId(*s.ProjectId)
		if name, ok := projectNames[*s.ProjectId]; ok {
			projectName = name
		}
	}

	// Only an online session has somewhere to link to. A حضوری one reports null
	// rather than an empty string — «آنلاین» and its link are one half of the
	// switch, and the other half has no place field at all.
	var url any
	if s.IsOnline && s.Url != nil {
		url = *s.Url
	}

	return http.Json{
		"id":    formatId(s.ID),
		"title": s.Title,
		// Who called the meeting — the only one who may change or delete it, or
		// add to its running order and its resolutions (loadSessionForOwner).
		// On the wire so the screen can stop offering what it would be refused.
		"ownerRefId":  s.OwnerRefId,
		"projectId":   projectId,
		"projectName": projectName,
		"startsAt":    startsAt,
		"url":         url,
		"isOnline":    s.IsOnline,
		"status":      s.Status,
		"memberCount": len(s.Members),
	}
}

func Sessions(sessions []models.Session, projectNames map[uint]string) []http.Json {
	result := make([]http.Json, len(sessions))
	for i := range sessions {
		result[i] = Session(&sessions[i], projectNames)
	}
	return result
}

// SessionMember is a `PickedItem` plus the one thing a project member has no
// equivalent of: whether the invite actually reached them. A session has no
// group to add anyone to, so that message is the only thing that told them.
func SessionMember(m *models.SessionMember) http.Json {
	var notifiedAt any
	if m.NotifiedAt != nil {
		notifiedAt = m.NotifiedAt.ToRfc3339String()
	}

	return http.Json{
		"id":          m.RefId,
		"source":      m.RefSource,
		"displayName": m.DisplayName,
		"username":    m.Username,
		"phone":       m.Phone,
		"online":      m.Online,
		"role":        m.Role,
		"notifiedAt":  notifiedAt,
	}
}

func SessionMembers(members []models.SessionMember) []http.Json {
	result := make([]http.Json, len(members))
	for i := range members {
		result[i] = SessionMember(&members[i])
	}
	return result
}

// SessionAgenda matches the `SessionAgenda` shape in modules/meeting/types.ts —
// «دستور جلسه», one line of the meeting's running order.
//
// durationMinutes is a single number rather than an {hours, minutes} pair
// because that is what it means: the wheel offers two columns and the sum is the
// value, so 1:30 travels as 90 and nothing downstream has to add them up.
func SessionAgenda(a *models.SessionAgenda) http.Json {
	var durationMinutes any
	if a.DurationMinutes != nil {
		durationMinutes = *a.DurationMinutes
	}

	return http.Json{
		"id":              formatId(a.ID),
		"sessionId":       formatId(a.SessionId),
		"title":           a.Title,
		"description":     a.Description,
		"durationMinutes": durationMinutes,
		"assigneeId":      a.AssigneeRefId,
		"assigneeName":    a.AssigneeName,
	}
}

func SessionAgendas(agendas []models.SessionAgenda) []http.Json {
	result := make([]http.Json, len(agendas))
	for i := range agendas {
		result[i] = SessionAgenda(&agendas[i])
	}
	return result
}

// AgendaTitles indexes agenda items by id, for the denormalized agendaTitle a
// Decision carries. Built here rather than in each controller because both the
// session screen (which already holds the agendas) and the flat مصوبات list
// (which has to load them) need the same map.
func AgendaTitles(agendas []models.SessionAgenda) map[uint]string {
	titles := make(map[uint]string, len(agendas))
	for i := range agendas {
		titles[agendas[i].ID] = agendas[i].Title
	}
	return titles
}

// SessionDetail is Session + its members + its running order + the decisions
// taken in it — what the session screen needs, in one response.
func SessionDetail(
	s *models.Session,
	projectNames map[uint]string,
	agendas []models.SessionAgenda,
	decisions []models.Decision,
	sessionTitles map[uint]string,
) http.Json {
	json := Session(s, projectNames)
	json["members"] = SessionMembers(s.Members)
	json["agendas"] = SessionAgendas(agendas)
	json["decisions"] = Decisions(decisions, sessionTitles, AgendaTitles(agendas))
	return json
}

// Decision matches the `Decision` shape in modules/meeting/types.ts.
//
// sessionTitle and agendaTitle are denormalized for the same reason projectName
// is: the مصوبات tab lists resolutions across every meeting and has to name the
// meeting — and the agenda item — each came out of without holding either list
// too. An id whose title the caller didn't load renders as null, which is also
// what "came out of no agenda item" looks like.
func Decision(d *models.Decision, sessionTitles map[uint]string, agendaTitles map[uint]string) http.Json {
	var dueAt string
	if d.DueAt != nil {
		dueAt = d.DueAt.ToRfc3339String()
	}

	var sessionId, sessionTitle any
	if d.SessionId != nil {
		sessionId = formatId(*d.SessionId)
		if title, ok := sessionTitles[*d.SessionId]; ok {
			sessionTitle = title
		}
	}

	var agendaId, agendaTitle any
	if d.AgendaId != nil {
		agendaId = formatId(*d.AgendaId)
		if title, ok := agendaTitles[*d.AgendaId]; ok {
			agendaTitle = title
		}
	}

	return http.Json{
		"id":          formatId(d.ID),
		"title":       d.Title,
		"description": d.Description,
		// Who recorded it. With assigneeId, this is the pair allowed to mark it
		// done (DecisionController.Update) — everyone else in the room reads it.
		"ownerRefId":   d.OwnerRefId,
		"sessionId":    sessionId,
		"sessionTitle": sessionTitle,
		"agendaId":     agendaId,
		"agendaTitle":  agendaTitle,
		"dueAt":        dueAt,
		"assigneeId":   d.AssigneeRefId,
		"assigneeName": d.AssigneeName,
		"status":       d.Status,
	}
}

func Decisions(decisions []models.Decision, sessionTitles map[uint]string, agendaTitles map[uint]string) []http.Json {
	result := make([]http.Json, len(decisions))
	for i := range decisions {
		result[i] = Decision(&decisions[i], sessionTitles, agendaTitles)
	}
	return result
}
