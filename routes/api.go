package routes

import (
	"github.com/goravel/framework/contracts/route"

	"goravel/app/facades"
	"goravel/app/http/controllers"
	"goravel/app/http/middleware"
)

// Api registers everything under /api/v1 — see API_CONTRACT.md for the
// real Project endpoints (not implemented yet). GET /me exists purely to
// verify the telegram-webapp auth guard end-to-end.
func Api() {
	facades.Route().Prefix("api/v1").Middleware(middleware.TelegramAuth()).Group(func(router route.Router) {
		meController := controllers.NewMeController()
		router.Get("/me", meController.Show)
	})
}
