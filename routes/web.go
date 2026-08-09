package routes

import (
	"strings"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
	"goravel/app/http/controllers"
)

func Web() {
	spaShell := func(ctx http.Context) http.Response {
		return ctx.Response().File("./public/index.html")
	}

	// public/{index.html,assets/} come from the frontend's Vite build (see
	// Dockerfile) — root-relative asset paths in that index.html expect
	// /assets/*, not /public/assets/*.
	facades.Route().Get("/", spaShell)
	facades.Route().Static("assets", "./public/assets")
	// Serves whatever UploadController.Store puts on the "public" disk
	// (storage/app/public), matching that disk's configured URL
	// (config/filesystems.go: APP_URL + "/storage").
	facades.Route().Static("storage", "./storage/app/public")

	userController := controllers.NewUserController()
	facades.Route().Get("/users", userController.Index)

	// React Router paths (e.g. /projects/5) have no matching server route on
	// a hard refresh — hand back the SPA shell so client-side routing can
	// take over. Real API misses still 404 instead of getting swallowed here.
	facades.Route().Fallback(func(ctx http.Context) http.Response {
		if strings.HasPrefix(ctx.Request().Path(), "/api/") {
			return ctx.Response().Status(404).Json(http.Json{"error": "not found"})
		}
		return spaShell(ctx)
	})
}
