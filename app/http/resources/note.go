package resources

import (
	"strings"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/models"
)

// noteExcerptRunes is how much of a body the list gets. Counted in runes, not
// bytes — Persian text is three bytes a character, so a byte limit would cut a
// note to a third of the intended length and could land mid-character.
const noteExcerptRunes = 120

// noteExcerpt flattens a body into the one-line preview the day dashboard
// shows. Whitespace is collapsed because the card renders a single line: raw
// newlines would otherwise come out as gaps in the middle of a sentence.
func noteExcerpt(body *string) any {
	if body == nil {
		return nil
	}
	flattened := strings.Join(strings.Fields(*body), " ")
	if flattened == "" {
		return nil
	}

	runes := []rune(flattened)
	if len(runes) <= noteExcerptRunes {
		return flattened
	}
	return strings.TrimRight(string(runes[:noteExcerptRunes]), " ") + "…"
}

// Note matches the `Note` shape in the frontend's modules/note/types.ts.
//
// projectNames maps project id → name for the notes being rendered; a note
// filed under a project the caller can no longer see simply reports a null
// name rather than failing the whole response.
func Note(n *models.Note, projectNames map[uint]string) http.Json {
	var projectId any
	var projectName any
	if n.ProjectId != nil {
		projectId = formatId(*n.ProjectId)
		if name, ok := projectNames[*n.ProjectId]; ok {
			projectName = name
		}
	}
	// The note's day. Server-set at insert time, and the only date a note has.
	var createdAt string
	if n.CreatedAt != nil {
		createdAt = n.CreatedAt.ToRfc3339String()
	}

	return http.Json{
		"id":          formatId(n.ID),
		"title":       n.Title,
		"excerpt":     noteExcerpt(n.Body),
		"projectId":   projectId,
		"projectName": projectName,
		"createdAt":   createdAt,
	}
}

func Notes(notes []models.Note, projectNames map[uint]string) []http.Json {
	result := make([]http.Json, len(notes))
	for i := range notes {
		result[i] = Note(&notes[i], projectNames)
	}
	return result
}
