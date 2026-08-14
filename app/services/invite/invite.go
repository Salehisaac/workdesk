// Package invite puts a link to one screen of the mini app into someone's chat
// with the bot.
//
// Two modules need this, for the same reason: they gather people without
// provisioning anything. A project's members are told it exists by the Rasagram
// supergroup appearing in their chat list — the group IS the invitation. A
// session (app/services/sessioninvite) and a ledger (app/services/ledgerinvite)
// provision no group, so the only thing that reaches their members is a message
// from the bot carrying a link back into the app.
//
// What the two share is exactly the transport: building that link, and getting a
// text delivered to a list of people inside a budget the create request can
// afford. What each keeps for itself is what only it can say — which screen the
// link opens, and how the message reads.
package invite

import (
	"net/url"
	"strconv"
	"strings"
	stdtime "time"

	"goravel/app/facades"
	"goravel/app/services/botapi"
)

// sendBudget bounds a whole invite pass, because this runs inside the create
// request and the client gives up on it after 15s (shared/api/client.ts).
//
// Each send is its own 15s-timeout HTTP call, so a Bot API that hangs rather
// than refusing would blow that budget on the first member and time the user out
// of something that was, in fact, created. Stopping early instead leaves the
// remaining members unreached — a state both screens report honestly («دعوت‌نامه
// برای n نفر فرستاده نشد») and a person can act on.
const sendBudget = 10 * stdtime.Second

// Link is the URL a member taps to open the mini app on one particular screen.
//
// Built from services.rasagram.miniapp_url — the app's own deep link, as the
// Rasagram client resolves it — with ?startapp=<startParam> appended. Note this
// is NOT the t.me formality the frontend's links.ts has to observe: that
// constraint comes from the SDK's openTelegramLink validator, which only ever
// sees links built inside the webview. This link travels the other way, as text
// in a chat message, so it has to be the address the client can actually
// resolve.
//
// Returns "" when the mini app's URL isn't configured, which callers treat as
// "don't send anything" rather than sending a link that goes nowhere.
func Link(startParam string) string {
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
	query.Set("startapp", startParam)
	parsed.RawQuery = query.Encode()
	return parsed.String()
}

// Send delivers text to each of refIds — the recipients' own user ids, which
// double as the chat_id of their DM with the bot.
//
// Returns the set of ids the message actually reached, so each caller can stamp
// its own member rows and its screen can be honest about who was told. Nothing
// here is fatal: a session or a book whose invites failed still exists, and the
// screens name whoever missed out.
func Send(text string, refIds []string) map[string]bool {
	client := botapi.New()
	deadline := stdtime.Now().Add(sendBudget)
	reached := make(map[string]bool, len(refIds))

	for _, refId := range refIds {
		// A picker that returned the same person twice must not spend two sends
		// (nor two lines of the budget) telling them the same thing.
		if reached[refId] {
			continue
		}
		if stdtime.Now().After(deadline) {
			facades.Log().Warning("workdesk: invites ran out of time — the rest were left unsent")
			break
		}
		// A group or channel picked as a "member" has a negative id on this
		// platform and is not a person with a private chat to receive an invite.
		// Skipped rather than attempted, so the log stays about real failures.
		if id, err := strconv.ParseInt(refId, 10, 64); err != nil || id <= 0 {
			continue
		}

		// A positive chat_id is a private chat on this platform (see
		// botapi.SendMessage), so the member's user id needs no transformation.
		// The send fails for anyone who has never started the bot, which is
		// expected and left unreached rather than treated as an error.
		if err := client.SendMessage(refId, text); err != nil {
			facades.Log().Error("workdesk: invite to " + refId + " failed: " + err.Error())
			continue
		}

		reached[refId] = true
	}

	return reached
}
