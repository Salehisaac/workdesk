// Package ledgerinvite tells a book's members that they may write in it.
//
// The same problem app/services/sessioninvite solves, one module over: a ledger
// provisions no Rasagram group, so nothing about it would ever appear in anyone's
// chat list on its own. Whoever was picked while the book was being created would
// have to be told about it by hand, somewhere else, before they could find it —
// which is a poor way to hand someone a book they are expected to keep.
//
// What is sent is deliberately thinner than a session's invite: a ledger is not
// an event, so there is no time and no place to state — only what the book is
// called and the link that opens it. Delivery itself is app/services/invite,
// shared with the session module.
package ledgerinvite

import (
	"fmt"
	"strings"

	"github.com/goravel/framework/support/carbon"

	"goravel/app/facades"
	"goravel/app/models"
	"goravel/app/services/invite"
)

// StartParamPrefix is what the frontend looks for in the launch parameter to
// know it was opened on a ledger — the ledger half of the mini app's
// startParamRoute(), whose session half is sessioninvite.StartParamPrefix.
const StartParamPrefix = "ledger"

// StartParam is the launch parameter that opens a given ledger.
func StartParam(ledgerId uint) string {
	return fmt.Sprintf("%s-%d", StartParamPrefix, ledgerId)
}

// Link is the URL a member taps to open the mini app on this book. Empty when
// the mini app's own URL isn't configured — see invite.Link.
func Link(ledgerId uint) string {
	return invite.Link(StartParam(ledgerId))
}

// Message is the text of the invite: which book, and how to open it.
//
// No date, no place, and no "join by" — the three things a session's invite
// leads with are the three a ledger genuinely doesn't have. What it says instead
// is what the recipient can now do, because that is the whole news: a book they
// can write in exists, and this is where it lives.
func Message(ledger *models.Ledger, link string) string {
	var b strings.Builder
	b.WriteString("📒 دعوت به دفتر مالی\n\n")
	b.WriteString(ledger.Name)
	b.WriteString("\n\nاز این پس می‌توانید در این دفتر درآمد و هزینه ثبت کنید و مانده‌اش را ببینید.")

	if link != "" {
		b.WriteString("\n\nبرای باز کردن دفتر:\n")
		b.WriteString(link)
	}

	return b.String()
}

// Send delivers the invite to every member of the book except the person who
// created it, exactly as sessioninvite.Send does and for the same reasons — the
// creator has just been looking at the screen that made it, members are stamped
// with notified_at as each send succeeds so the caller can persist them in one
// write, and a failed send is never fatal.
//
// Returns how many messages went out.
func Send(ledger *models.Ledger, members []models.LedgerMember) int {
	link := Link(ledger.ID)
	if link == "" {
		facades.Log().Warning("workdesk: services.rasagram.miniapp_url is not configured — ledger invites were not sent")
		return 0
	}

	recipients := make([]string, 0, len(members))
	for i := range members {
		if members[i].RefId == ledger.OwnerRefId {
			continue
		}
		recipients = append(recipients, members[i].RefId)
	}

	reached := invite.Send(Message(ledger, link), recipients)

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
