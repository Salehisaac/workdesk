package routes

import (
	"github.com/goravel/framework/contracts/route"

	"goravel/app/facades"
	"goravel/app/http/controllers"
	"goravel/app/http/middleware"
)

// Api registers everything under /api/v1 — see API_CONTRACT.md for the exact
// request/response shapes. GET /me is diagnostic-only, not part of the
// contract, kept to verify the auth guard independently of the real
// endpoints.
func Api() {
	facades.Route().Prefix("api/v1").Middleware(middleware.TelegramAuth()).Group(func(router route.Router) {
		meController := controllers.NewMeController()
		router.Get("/me", meController.Show)

		projectController := controllers.NewProjectController()
		router.Get("/projects", projectController.Index)
		router.Post("/projects", projectController.Store)
		router.Get("/projects/{id}", projectController.Show)

		listController := controllers.NewProjectListController()
		router.Post("/projects/{id}/lists", listController.Store)
		router.Delete("/projects/{id}/lists/{listId}", listController.Destroy)

		topicIconController := controllers.NewTopicIconController()
		router.Get("/topic-icons", topicIconController.Index)
		router.Get("/topic-icons/animation", topicIconController.Animation)

		uploadController := controllers.NewUploadController()
		router.Post("/uploads", uploadController.Store)
	})
}
