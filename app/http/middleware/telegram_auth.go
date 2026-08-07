package middleware

import (
	nethttp "net/http"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
)

// TelegramAuth gates a route group behind the telegram-webapp guard (plan
// section 5). On success, continues to the handler; on failure, aborts with
// 401 and the guard's own error message.
func TelegramAuth() http.Middleware {
	return &telegramAuthMiddleware{}
}

type telegramAuthMiddleware struct{}

func (m *telegramAuthMiddleware) Signature() string {
	return "workdesk:telegram-auth"
}

func (m *telegramAuthMiddleware) Handle(ctx http.Context) {
	auth := facades.Auth(ctx)
	if !auth.Check() {
		message := "unauthorized"
		if _, err := auth.ID(); err != nil {
			message = err.Error()
		}
		_ = ctx.Response().Json(nethttp.StatusUnauthorized, http.Json{"error": message}).Abort()
		return
	}
	ctx.Request().Next()
}
