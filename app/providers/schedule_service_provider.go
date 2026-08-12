package providers

import (
	"github.com/goravel/framework/contracts/foundation"
	"github.com/goravel/framework/contracts/schedule"

	"goravel/app/facades"
	"goravel/app/services/reminders"
)

// ScheduleServiceProvider registers WorkDesk's recurring work.
//
// The framework's own schedule runner starts as part of app.Start(), but only
// when at least one event is registered (ScheduleRunner.ShouldRun checks
// len(Events()) > 0) — so without this provider the scheduler is present and
// idle. Registering in Boot happens before runners start, which is what makes
// the events visible to it.
type ScheduleServiceProvider struct{}

func (r *ScheduleServiceProvider) Register(app foundation.Application) {}

func (r *ScheduleServiceProvider) Boot(app foundation.Application) {
	facades.Schedule().Register([]schedule.Event{
		// A minute is the finest granularity worth having: reminders are set to
		// a wall-clock minute, so a sweep more often than that would only ever
		// find the same rows.
		facades.Schedule().Call(func() {
			reminders.DispatchDue()
		}).
			EveryMinute().
			// A slow batch must not stack passes on top of each other and send
			// anything twice.
			SkipIfStillRunning().
			// The scheduler lives inside the API process, so every replica runs
			// one. This takes a cache lock so only one of them actually sends.
			OnOneServer().
			Name("reminders:dispatch"),
	})
}
