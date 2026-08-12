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
	// Two different deliveries: confirmedAt is the "saved it" message sent at
	// creation, notifiedAt is the reminder itself firing at remindAt. Both null
	// when the bot couldn't reach the chat, so the UI can say so rather than
	// implying a message went out.
	var confirmedAt any
	if r.ConfirmedAt != nil {
		confirmedAt = r.ConfirmedAt.ToRfc3339String()
	}
	var notifiedAt any
	if r.NotifiedAt != nil {
		notifiedAt = r.NotifiedAt.ToRfc3339String()
	}
	var createdAt string
	if r.CreatedAt != nil {
		createdAt = r.CreatedAt.ToRfc3339String()
	}

	return http.Json{
		"id":          formatId(r.ID),
		"title":       r.Title,
		"note":        r.Note,
		"remindAt":    remindAt,
		"confirmedAt": confirmedAt,
		"notifiedAt":  notifiedAt,
		"createdAt":   createdAt,
	}
}

func Reminders(reminders []models.Reminder) []http.Json {
	result := make([]http.Json, len(reminders))
	for i := range reminders {
		result[i] = Reminder(&reminders[i])
	}
	return result
}
