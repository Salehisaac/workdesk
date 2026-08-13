// Package sessioninvite tells a meeting's members that it exists.
//
// This is the whole difference between a Session and a Project. Creating a
// project provisions a Rasagram supergroup and adds everyone to it, so the
// invitation is the group appearing in their chat list. A session provisions
// nothing — so the only thing that reaches its members is the message this
// package sends: the meeting's title, when and where it is, and a link that
// opens the mini app on that meeting.
package sessioninvite

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"
	stdtime "time"

	"github.com/goravel/framework/support/carbon"

	"goravel/app/facades"
	"goravel/app/models"
	"goravel/app/services/botapi"
	"goravel/app/support/jalali"
)

// sendBudget bounds the whole invite pass, because this runs inside the create
// request and the client gives up on it after 15s (shared/api/client.ts).
//
// Each send is its own 15s-timeout HTTP call, so a Bot API that hangs rather
// than refusing would blow that budget on the first member and time the user
// out of a session that was, in fact, created. Stopping early instead leaves the
// remaining members at notified_at = null — a state the screen already reports
// honestly ("دعوت‌نامه برای n نفر فرستاده نشد") and a person can act on.
const sendBudget = 10 * stdtime.Second

// StartParamPrefix is what the frontend looks for in the launch parameter to
// know it was opened on a session — see the mini app's readStartParam(). Kept
// as a constant on both sides of the wire so the two can be grepped together.
//
// A hyphen, not an underscore: the platform's own launch parameter grammar is
// the Telegram one (A-Z, a-z, 0-9, _ and -), and both are legal, but the
// frontend splits on the first hyphen to get <kind>-<id>.
const StartParamPrefix = "session"

// StartParam is the launch parameter that opens a given session.
func StartParam(sessionId uint) string {
	return fmt.Sprintf("%s-%d", StartParamPrefix, sessionId)
}

// Link is the URL a member taps to open the session in the mini app.
//
// Built from services.rasagram.miniapp_url — the app's own deep link, as the
// Rasagram client resolves it — with ?startapp= appended. Note this is NOT the
// t.me formality the frontend's links.ts has to observe: that constraint comes
// from the SDK's openTelegramLink validator, which only ever sees links built
// inside the webview. This link travels the other way, as text in a chat
// message, so it has to be the address the client can actually resolve.
//
// Returns "" when the mini app's URL isn't configured, which callers treat as
// "don't send anything" rather than sending a link that goes nowhere.
func Link(sessionId uint) string {
	base := strings.TrimSpace(facades.Config().GetString("services.rasagram.miniapp_url"))
	if base == "" {
		return ""
	}

	parsed, err := url.Parse(base)
	if err != nil {
		facades.Log().Error("workdesk: services.rasagram.miniapp_url is not a URL: " + err.Error())
		return ""
	}

	// Set rather than append: a base that already carries a startapp (a
	// copy-pasted link from somewhere else) must not produce two of them, where
	// which one wins is up to the client.
	query := parsed.Query()
	query.Set("startapp", StartParam(sessionId))
	parsed.RawQuery = query.Encode()
	return parsed.String()
}

// Message is the text of the invite — the meeting, in the shape someone reading
// their chat list needs it: what it is, when, where, and how to open it.
func Message(session *models.Session, link string) string {
	var b strings.Builder
	b.WriteString("🗓 دعوت به جلسه\n\n")
	b.WriteString(session.Title)

	if session.StartsAt != nil {
		b.WriteString("\n\n🕘 ")
		// Same treatment the reminder dispatcher gives its own timestamps: the
		// stored instant, rendered into the display zone (Asia/Tehran) so the
		// text reads the way the person who set it saw it.
		b.WriteString(jalali.FormatDateTime(session.StartsAt.StdTime()))
	}

	if session.IsOnline {
		b.WriteString("\n📍 آنلاین")
	} else if session.Location != nil && strings.TrimSpace(*session.Location) != "" {
		b.WriteString("\n📍 ")
		b.WriteString(*session.Location)
	}

	if link != "" {
		b.WriteString("\n\nبرای دیدن جلسه و مصوبه‌هایش:\n")
		b.WriteString(link)
	}

	return b.String()
}

// Send delivers the invite to every member of the session except the person who
// created it — they were just looking at the screen that made it, and a bot
// messaging you about something you did a second ago is noise, not news.
//
// Members are stamped with notified_at as each send succeeds, and returned
// updated, so the caller can persist them in one write and the UI can be honest
// about who was actually reached. Nothing here is fatal: a session whose invites
// failed is still a session, and the screen shows who missed out.
//
// Returns how many messages went out.
func Send(session *models.Session, members []models.SessionMember) int {
	link := Link(session.ID)
	if link == "" {
		facades.Log().Warning("workdesk: services.rasagram.miniapp_url is not configured — session invites were not sent")
		return 0
	}

	client := botapi.New()
	text := Message(session, link)
	deadline := stdtime.Now().Add(sendBudget)
	sent := 0

	for i := range members {
		member := &members[i]
		if member.RefId == session.OwnerRefId {
			continue
		}
		if stdtime.Now().After(deadline) {
			facades.Log().Warning("workdesk: session invites ran out of time — the rest were left unsent")
			break
		}
		// A group or channel picked as a "member" has a negative id on this
		// platform and is not a person with a private chat to receive an invite.
		// Skipped rather than attempted, so the log stays about real failures.
		if id, err := strconv.ParseInt(member.RefId, 10, 64); err != nil || id <= 0 {
			continue
		}

		// The member's user id doubles as the chat_id of their DM with the bot —
		// a positive chat_id is a private chat on this platform (see
		// botapi.SendMessage). The send fails for anyone who has never started
		// the bot, which is expected and left as notified_at = null.
		if err := client.SendMessage(member.RefId, text); err != nil {
			facades.Log().Error("workdesk: session invite to " + member.RefId + " failed: " + err.Error())
			continue
		}

		member.NotifiedAt = carbon.NewDateTime(carbon.Now())
		sent++
	}

	return sent
}
