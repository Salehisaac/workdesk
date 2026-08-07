package routes

import (
	"github.com/goravel/framework/contracts/http"
	"github.com/goravel/framework/support"

	"goravel/app/facades"
	"goravel/app/http/controllers"
)

func Web() {
	facades.Route().Get("/", func(ctx http.Context) http.Response {
		return ctx.Response().View().Make("welcome.tmpl", map[string]any{
			"version": support.Version,
		})
	})

	facades.Route().Static("public", "./public")
	// Serves whatever UploadController.Store puts on the "public" disk
	// (storage/app/public), matching that disk's configured URL
	// (config/filesystems.go: APP_URL + "/storage").
	facades.Route().Static("storage", "./storage/app/public")

	userController := controllers.NewUserController()
	facades.Route().Get("/users", userController.Index)
}
