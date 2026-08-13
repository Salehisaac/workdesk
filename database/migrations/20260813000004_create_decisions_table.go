package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260813000004CreateDecisionsTable struct{}

// Signature The unique signature for the migration.
func (r *M20260813000004CreateDecisionsTable) Signature() string {
	return "20260813000004_create_decisions_table"
}

// Up Run the migrations.
//
// A «مصوبه» is what a session produced: a thing somebody agreed to do, by a day.
// It is not a Job — a job lives in a list on a project board and moves through
// six states; a decision is a one-line commitment whose whole lifecycle is
// open → done (or canceled), and whose context is the meeting it was taken in.
//
// session_id is nullable so the مصوبات tab can still hold a resolution whose
// meeting was deleted, and so one can be recorded outside a session later.
func (r *M20260813000004CreateDecisionsTable) Up() error {
	if facades.Schema().HasTable("decisions") {
		return nil
	}

	return facades.Schema().Create("decisions", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("session_id").Nullable()
		table.String("owner_ref_id")
		table.String("title")
		// The day it is due — what places it on the home calendar. Time-of-day
		// carries no meaning here (the frontend's Decision.hasTime is false), but
		// the column is a timestamp so the stored instant is unambiguous.
		table.DateTimeTz("due_at")
		// Who took it on. Denormalized display name beside the opaque ref, same
		// bargain project_members makes: no join into data WorkDesk doesn't own.
		table.String("assignee_ref_id").Nullable()
		table.String("assignee_name").Nullable()
		// open | done | canceled — DECISION_STATUS_LABEL in the frontend's
		// modules/meeting/types.ts.
		table.String("status", 20).Default("open")
		table.TimestampsTz()

		// NullOnDelete: a resolution outlives the meeting's record of itself.
		table.Foreign("session_id").References("id").On("sessions").NullOnDelete()
		table.Index("session_id")
		table.Index("owner_ref_id")
		table.Index("due_at")
	})
}

// Down Reverse the migrations.
func (r *M20260813000004CreateDecisionsTable) Down() error {
	return facades.Schema().DropIfExists("decisions")
}
