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
		// Both are the creator's alone (loadProjectForOwner). DELETE takes the
		// project's Rasagram group with it — every list is a topic in that
		// group — so the frontend warns before calling it.
		router.Patch("/projects/{id}", projectController.Update)
		router.Delete("/projects/{id}", projectController.Destroy)

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
		// Writes stay project-scoped, so the membership check has a project
		// to check against (see loadProjectForMember).
		jobController := controllers.NewJobController()
		router.Get("/jobs", jobController.Index)
		router.Post("/projects/{id}/jobs", jobController.Store)
		router.Patch("/projects/{id}/jobs/{jobId}", jobController.Update)

		// «مخزن جلسه». A session is shaped like a project and provisions no
		// group — creating one DMs every member a deep link back into the mini
		// app instead (app/services/sessioninvite).
		sessionController := controllers.NewSessionController()
		router.Get("/sessions", sessionController.Index)
		router.Post("/sessions", sessionController.Store)
		router.Get("/sessions/{id}", sessionController.Show)
		router.Patch("/sessions/{id}", sessionController.Update)

		// «دستور جلسه» — the meeting's running order. Write-only here: it is read
		// as part of GET /sessions/{id}, which carries `agendas`.
		sessionAgendaController := controllers.NewSessionAgendaController()
		router.Post("/sessions/{id}/agendas", sessionAgendaController.Store)

		// Decisions read flat and write session-scoped, the same split /jobs
		// uses: the flat read feeds the home calendar and the مصوبات tab, the
		// scoped write gives the membership check a session to check against.
		decisionController := controllers.NewDecisionController()
		router.Get("/decisions", decisionController.Index)
		router.Post("/sessions/{id}/decisions", decisionController.Store)
		router.Patch("/decisions/{id}", decisionController.Update)

		// «دفتر مالی». The third module that gathers people without provisioning
		// anything — no group like a project, and unlike a session, no invite
		// either: its members find the book in their own list. Transactions are
		// written ledger-scoped and read as part of GET /ledgers/{id}, never
		// flat, because an amount outside its book has no balance to belong to.
		ledgerController := controllers.NewLedgerController()
		router.Get("/ledgers", ledgerController.Index)
		router.Post("/ledgers", ledgerController.Store)
		router.Get("/ledgers/{id}", ledgerController.Show)
		// The two pools a transaction draws from. Write-only here, like session
		// agendas: both are read as part of the ledger they belong to.
		router.Post("/ledgers/{id}/tags", ledgerController.StoreTag)
		router.Post("/ledgers/{id}/sources", ledgerController.StoreSource)

		ledgerTransactionController := controllers.NewLedgerTransactionController()
		router.Post("/ledgers/{id}/transactions", ledgerTransactionController.Store)
		// The only delete in the app: a mistyped amount is a balance that lies,
		// and every screen in the module is derived from these rows.
		router.Delete("/ledgers/{id}/transactions/{transactionId}", ledgerTransactionController.Destroy)

		// Reminders belong to a person, not a project — creating one DMs it to
		// the owner via the bot.
		reminderController := controllers.NewReminderController()
		router.Get("/reminders", reminderController.Index)
		router.Post("/reminders", reminderController.Store)

		// Notes are personal like reminders, and flat for the same reason
		// /jobs is: the home calendar wants every day at once. Writes accept
		// today only — the rule lives in NoteController.Store.
		noteController := controllers.NewNoteController()
		router.Get("/notes", noteController.Index)
		router.Post("/notes", noteController.Store)

		topicIconController := controllers.NewTopicIconController()
		router.Get("/topic-icons", topicIconController.Index)
		router.Get("/topic-icons/animation", topicIconController.Animation)

		uploadController := controllers.NewUploadController()
		router.Post("/uploads", uploadController.Store)
	})
}
