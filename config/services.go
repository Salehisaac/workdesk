package config

import (
	"goravel/app/facades"
)

func init() {
	config := facades.Config()
	config.Add("services", map[string]any{
		// The bot WorkDesk is registered as (plan section 5/8). Its token is
		// used two ways: locally re-deriving the HMAC that verifies every
		// request's initData (app/support/telegramauth — no network call),
		// and authenticating outbound Bot API calls (createForumTopic,
		// sendMessage, etc. — plan section 8, not implemented yet).
		"rasagram": map[string]any{
			"bot_token": config.Env("RASAGRAM_BOT_TOKEN", ""),
			// Host serving the Bot API (teamgram.io/bots' botway service —
			// /bot<token>/<method>, standard Telegram Bot API shape). Used
			// by app/services/botapi for the per-List forum topic lifecycle.
			"bot_api_base_url": config.Env("RASAGRAM_BOT_API_BASE_URL", ""),
			// The mini app's own link, as the Rasagram client resolves it —
			// e.g. https://rsog.rso-co.ir/<bot username>/<app short name>.
			// app/services/invite appends ?startapp=<param> to it, which is the
			// only way an outgoing message can point a member at one particular
			// screen inside the app (see that package, and its two callers
			// sessioninvite and ledgerinvite). Blank disables invites rather
			// than sending a broken link.
			"miniapp_url": config.Env("RASAGRAM_MINIAPP_URL", ""),
		},

		// Internal admin API (app/services/rasagramadmin) — creates the
		// dedicated topic-group a Project needs (plan section 8). Separate
		// from the bot token above: server-to-server only, never reaches
		// the frontend.
		"rasagram_admin": map[string]any{
			"base_url": config.Env("RASAGRAM_ADMIN_BASE_URL", ""),
			"username": config.Env("RASAGRAM_ADMIN_USERNAME", ""),
			"password": config.Env("RASAGRAM_ADMIN_PASSWORD", ""),
		},
	})
}
