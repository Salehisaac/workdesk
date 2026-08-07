package providers

import (
	"github.com/goravel/framework/contracts/foundation"

	"goravel/app/facades"
	"goravel/app/guards"
)

// AuthServiceProvider registers WorkDesk's custom auth guard. Boot runs at
// app startup, well before any request — safe to call facades.Auth() with no
// context here, since Extend only stores the constructor for later (plan
// section 5); see app/guards/telegram_webapp_guard.go for what actually runs
// per-request.
type AuthServiceProvider struct{}

func (r *AuthServiceProvider) Register(app foundation.Application) {}

func (r *AuthServiceProvider) Boot(app foundation.Application) {
	facades.Auth().Extend("telegram-webapp", guards.NewTelegramWebAppGuard)
}
