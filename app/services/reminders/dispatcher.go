// Package reminders delivers due reminders to their owners' direct chats.
//
// This is what makes a reminder a reminder: the message arrives at remind_at,
// in a chat the user already reads, without them opening the mini-app.
package reminders

import (
	"strings"

	"github.com/goravel/framework/support/carbon"

	"goravel/app/facades"
	"goravel/app/models"
	"goravel/app/services/botapi"
	"goravel/app/support/jalali"
)

// How many reminders one pass will send. The sweep runs every minute, so this
// is only ever reached after downtime — and then it drains over the following
// minutes instead of firing hundreds of messages in a single tick.
const batchSize = 100

// DispatchDue sends every reminder that has come due and hasn't been sent yet,
// and returns how many went out and how many failed.
//
// Delivery is idempotent through notified_at: a reminder is only picked up
// while that column is null, and it's stamped the moment the send succeeds. A
// failed send leaves it null, so the next pass retries — which is why a
// transient bot outage costs a delay rather than a lost reminder.
func DispatchDue() (sent int, failed int) {
	var due []models.Reminder
	if err := facades.Orm().Query().
		Where("notified_at IS NULL").
		Where("remind_at <= ?", carbon.Now().ToDateTimeString()).
		OrderBy("remind_at").
		Limit(batchSize).
		Find(&due); err != nil {
		facades.Log().Error("workdesk: loading due reminders failed: " + err.Error())
		return 0, 0
	}

	client := botapi.New()
	for i := range due {
		reminder := &due[i]
		if err := client.SendMessage(reminder.OwnerRefId, DueMessage(reminder)); err != nil {
			facades.Log().Error("workdesk: reminder " + reminder.Title + " failed to send: " + err.Error())
			failed++
			continue
		}

		reminder.NotifiedAt = carbon.NewDateTime(carbon.Now())
		if err := facades.Orm().Query().Save(reminder); err != nil {
			// The message is already out; failing to stamp it means the next
			// pass sends it again. Logged loudly because a duplicate reminder
			// is the visible symptom.
			facades.Log().Error("workdesk: marking reminder sent failed: " + err.Error())
		}
		sent++
	}

	return sent, failed
}

// DueMessage is the reminder itself, as opposed to the confirmation sent when
// it was created.
func DueMessage(reminder *models.Reminder) string {
	var b strings.Builder
	b.WriteString("⏰ یادآور\n\n")
	b.WriteString(reminder.Title)
	if reminder.Note != nil {
		b.WriteString("\n")
		b.WriteString(*reminder.Note)
	}
	if reminder.RemindAt != nil {
		b.WriteString("\n\n🗓 ")
		// Unlike the creation confirmation — which formats the offset the client
		// sent — this runs long after the request is gone, so the stored instant
		// is all there is. It renders in the server's zone; set TZ on the
		// container (Asia/Tehran) for the text to read the way the user set it.
		b.WriteString(jalali.FormatDateTime(reminder.RemindAt.StdTime()))
	}
	return b.String()
}
