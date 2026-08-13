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

	// An online session has no room, so it reports none — «آنلاین» is a separate
	// flag the UI renders in place of a location, not a location spelled out.
	var location any
	if !s.IsOnline && s.Location != nil {
		location = *s.Location
	}

	return http.Json{
		"id":          formatId(s.ID),
		"title":       s.Title,
		"projectId":   projectId,
		"projectName": projectName,
		"startsAt":    startsAt,
		"location":    location,
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

// SessionDetail is Session + its members + the decisions taken in it — what the
// session screen needs, in one response.
func SessionDetail(s *models.Session, projectNames map[uint]string, decisions []models.Decision, sessionTitles map[uint]string) http.Json {
	json := Session(s, projectNames)
	json["members"] = SessionMembers(s.Members)
	json["decisions"] = Decisions(decisions, sessionTitles)
	return json
}

// Decision matches the `Decision` shape in modules/meeting/types.ts.
//
// sessionTitle is denormalized for the same reason projectName is: the مصوبات
// tab lists resolutions across every meeting and has to name the meeting each
// came out of without holding the sessions list too.
func Decision(d *models.Decision, sessionTitles map[uint]string) http.Json {
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

	return http.Json{
		"id":           formatId(d.ID),
		"title":        d.Title,
		"sessionId":    sessionId,
		"sessionTitle": sessionTitle,
		"dueAt":        dueAt,
		"assigneeId":   d.AssigneeRefId,
		"assigneeName": d.AssigneeName,
		"status":       d.Status,
	}
}

func Decisions(decisions []models.Decision, sessionTitles map[uint]string) []http.Json {
	result := make([]http.Json, len(decisions))
	for i := range decisions {
		result[i] = Decision(&decisions[i], sessionTitles)
	}
	return result
}
