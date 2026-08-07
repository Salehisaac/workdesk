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
		},
	})
}
