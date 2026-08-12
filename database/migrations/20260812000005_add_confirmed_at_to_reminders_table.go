package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260812000005AddConfirmedAtToRemindersTable struct{}

// Signature The unique signature for the migration.
func (r *M20260812000005AddConfirmedAtToRemindersTable) Signature() string {
	return "20260812000005_add_confirmed_at_to_reminders_table"
}

// Up Run the migrations.
//
// Splits two things that were sharing notified_at. A reminder now gets two
// messages at different times — the "saved it" confirmation when you create it,
// and the reminder itself when it comes due — and they need separate marks:
// with one column, a delivered confirmation would make the dispatcher believe
// the reminder had already fired and skip it forever.
//
//	confirmed_at — the creation confirmation reached the user's chat
//	notified_at  — the reminder itself fired at remind_at
func (r *M20260812000005AddConfirmedAtToRemindersTable) Up() error {
	if !facades.Schema().HasTable("reminders") {
		return nil
	}
	if facades.Schema().HasColumn("reminders", "confirmed_at") {
		return nil
	}

	return facades.Schema().Table("reminders", func(table schema.Blueprint) {
		table.DateTimeTz("confirmed_at").Nullable()
	})
}

// Down Reverse the migrations.
func (r *M20260812000005AddConfirmedAtToRemindersTable) Down() error {
	if !facades.Schema().HasTable("reminders") {
		return nil
	}

	return facades.Schema().Table("reminders", func(table schema.Blueprint) {
		table.DropColumn("confirmed_at")
	})
}
