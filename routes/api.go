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

		// Tags are project-scoped: every Job in every List of a project draws
		// from the same pool.
		tagController := controllers.NewProjectTagController()
		router.Get("/projects/{id}/tags", tagController.Index)
		router.Post("/projects/{id}/tags", tagController.Store)

		// GET /jobs is flat on purpose — the home calendar needs every
		// deadline the caller can see, across all their projects, in one go.
		jobController := controllers.NewJobController()
		router.Get("/jobs", jobController.Index)
		router.Post("/projects/{id}/jobs", jobController.Store)

		// Reminders belong to a person, not a project — creating one DMs it to
		// the owner via the bot.
		reminderController := controllers.NewReminderController()
		router.Get("/reminders", reminderController.Index)
		router.Post("/reminders", reminderController.Store)

		topicIconController := controllers.NewTopicIconController()
		router.Get("/topic-icons", topicIconController.Index)
		router.Get("/topic-icons/animation", topicIconController.Animation)

		uploadController := controllers.NewUploadController()
		router.Post("/uploads", uploadController.Store)
	})
}
