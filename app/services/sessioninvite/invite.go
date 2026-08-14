// Package sessioninvite tells a meeting's members that it exists.
//
// Creating a project provisions a Rasagram supergroup and adds everyone to it,
// so the invitation is the group appearing in their chat list. A session
// provisions nothing — so the only thing that reaches its members is the message
// this package sends: the meeting's title, when and where it is, and a link that
// opens the mini app on that meeting.
//
// The link and the delivery itself live in app/services/invite, shared with the
// ledger module, which invites the same way for the same reason. What stays here
// is what only a meeting can say: which screen to open, and how the message
// reads.
package sessioninvite

import (
	"fmt"
	"strings"

	"github.com/goravel/framework/support/carbon"

	"goravel/app/facades"
	"goravel/app/models"
	"goravel/app/services/invite"
	"goravel/app/support/jalali"
)

// StartParamPrefix is what the frontend looks for in the launch parameter to
// know it was opened on a session — see the mini app's startParamRoute(). Kept
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

// Link is the URL a member taps to open the mini app on this session. Empty when
// the mini app's own URL isn't configured — see invite.Link.
func Link(sessionId uint) string {
	return invite.Link(StartParam(sessionId))
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
		// The link on its own line, unlabelled: every chat client turns a bare
		// URL into something tappable, and this is the address the meeting
		// actually happens at — worth being the thing a reader's eye lands on.
		if session.Url != nil && strings.TrimSpace(*session.Url) != "" {
			b.WriteString("\n")
			b.WriteString(strings.TrimSpace(*session.Url))
		}
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

	recipients := make([]string, 0, len(members))
	for i := range members {
		if members[i].RefId == session.OwnerRefId {
			continue
		}
		recipients = append(recipients, members[i].RefId)
	}

	reached := invite.Send(Message(session, link), recipients)

	sent := 0
	for i := range members {
		if !reached[members[i].RefId] {
			continue
		}
		members[i].NotifiedAt = carbon.NewDateTime(carbon.Now())
		sent++
	}

	return sent
}
