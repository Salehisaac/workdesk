package resources

import (
	"github.com/goravel/framework/contracts/http"

	"goravel/app/models"
)

// Reminder matches the `Reminder` shape in the frontend's modules/reminder/types.ts.
func Reminder(r *models.Reminder) http.Json {
	var remindAt any
	if r.RemindAt != nil {
		remindAt = r.RemindAt.ToRfc3339String()
	}
	// Null until the reminder has actually fired — the UI shows a pending clock
	// rather than a delivered tick while it's waiting.
	var notifiedAt any
	if r.NotifiedAt != nil {
		notifiedAt = r.NotifiedAt.ToRfc3339String()
	}
	var createdAt string
	if r.CreatedAt != nil {
		createdAt = r.CreatedAt.ToRfc3339String()
	}

	return http.Json{
		"id":         formatId(r.ID),
		"title":      r.Title,
		"note":       r.Note,
		"remindAt":   remindAt,
		"notifiedAt": notifiedAt,
		"createdAt":  createdAt,
	}
}

func Reminders(reminders []models.Reminder) []http.Json {
	result := make([]http.Json, len(reminders))
	for i := range reminders {
		result[i] = Reminder(&reminders[i])
	}
	return result
}
