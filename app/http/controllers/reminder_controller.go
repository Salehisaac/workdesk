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
// Saves it and stops there. Nothing is sent now: the only message a reminder
// produces is the reminder itself, delivered at remind_at by
// app/services/reminders. Confirming a save in the user's chat was noise —
// the home dashboard already shows the reminder on its day.
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

	// RFC3339 via the standard library, so an offset-carrying value from the
	// client (see toLocalIso) parses to the right instant. Rendering is a
	// separate concern — support/jalali converts into the display zone itself.
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

	return ctx.Response().Status(201).Json(resources.Reminder(&reminder))
}
