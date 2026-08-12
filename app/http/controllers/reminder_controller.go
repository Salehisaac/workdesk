package controllers

import (
	"strings"
	stdtime "time"

	"github.com/goravel/framework/contracts/http"
	"github.com/goravel/framework/support/carbon"

	"goravel/app/facades"
	"goravel/app/http/resources"
	"goravel/app/models"
	"goravel/app/services/botapi"
	"goravel/app/support/jalali"
)

// ReminderController handles «یادآور» — the one WorkDesk module that talks to a
// person rather than a project. Everything else posts into a group topic;
// a reminder goes to the owner's direct chat with the bot.
type ReminderController struct{}

func NewReminderController() *ReminderController {
	return &ReminderController{}
}

type storeReminderRequest struct {
	Title    string `json:"title"`
	Note     string `json:"note"`
	RemindAt string `json:"remindAt"`
}

// Index — GET /api/v1/reminders. The caller's own reminders, soonest first.
func (r *ReminderController) Index(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	var reminders []models.Reminder
	if err := facades.Orm().Query().
		Where("owner_ref_id", authUser.ID).
		OrderBy("remind_at").
		Find(&reminders); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Success().Json(resources.Reminders(reminders))
}

// Store — POST /api/v1/reminders.
//
// Creating a reminder delivers it straight to the owner's DM. That's the whole
// point of the module living inside a messenger: the reminder arrives in a chat
// the user already reads, instead of waiting behind a mini-app they'd have to
// remember to open.
func (r *ReminderController) Store(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	var request storeReminderRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "invalid request body"})
	}

	title := strings.TrimSpace(request.Title)
	if title == "" {
		return ctx.Response().Status(422).Json(http.Json{"error": "title is required"})
	}

	// Parsed with the standard library rather than carbon.Parse: carbon
	// normalizes into its configured default zone, which keeps the instant but
	// throws away the offset the client sent — and the offset is precisely what
	// the message text needs to print the user's own wall clock. time.Parse
	// keeps it on the returned Time's location.
	remindAt, err := stdtime.Parse(stdtime.RFC3339, strings.TrimSpace(request.RemindAt))
	if err != nil {
		return ctx.Response().Status(422).Json(http.Json{"error": "remindAt must be an RFC 3339 timestamp"})
	}

	reminder := models.Reminder{
		// The owner's user id is also the chat_id of their DM with the bot.
		OwnerRefId: authUser.ID,
		Title:      title,
		// Stored as the absolute instant — that's what a scheduler compares on.
		RemindAt: carbon.NewDateTime(carbon.FromStdTime(remindAt)),
	}
	if note := strings.TrimSpace(request.Note); note != "" {
		reminder.Note = &note
	}
	if err := facades.Orm().Query().Create(&reminder); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	// Confirmation only — the reminder itself is sent later by the scheduler
	// (app/services/reminders). This stamps confirmed_at, never notified_at:
	// notified_at is the dispatcher's "already fired" guard, and setting it here
	// would mean the reminder is never actually delivered.
	//
	// A failed confirmation doesn't invalidate the reminder; the row is saved
	// either way and will still fire on time. The response carries the null so
	// the UI can say it saved without implying a message went out.
	if err := botapi.New().SendMessage(authUser.ID, confirmationMessage(&reminder, remindAt)); err != nil {
		facades.Log().Error("workdesk: reminder confirmation DM failed: " + err.Error())
	} else {
		reminder.ConfirmedAt = carbon.NewDateTime(carbon.Now())
		if err := facades.Orm().Query().Save(&reminder); err != nil {
			facades.Log().Error("workdesk: marking reminder confirmed failed: " + err.Error())
		}
	}

	return ctx.Response().Status(201).Json(resources.Reminder(&reminder))
}

// confirmationMessage acknowledges the reminder at creation time. The reminder
// itself is a different message, sent when it comes due — see
// reminders.DueMessage.
//
// `remindAt` is the offset-preserving parse of what the client sent, not the
// stored value: the frontend sends its own UTC offset (see toLocalIso) so the
// text prints the user's wall clock. Formatting the normalized instant instead
// would show an Iranian user's 14:05 as 10:35, and a late-evening reminder
// would land on the previous Jalali day.
func confirmationMessage(reminder *models.Reminder, remindAt stdtime.Time) string {
	var b strings.Builder
	b.WriteString("⏰ یادآور ثبت شد\n\n")
	b.WriteString(reminder.Title)
	if reminder.Note != nil {
		b.WriteString("\n")
		b.WriteString(*reminder.Note)
	}
	b.WriteString("\n\n🗓 ")
	b.WriteString(jalali.FormatDateTime(remindAt))
	return b.String()
}
