package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260812000006DropConfirmedAtFromRemindersTable struct{}

// Signature The unique signature for the migration.
func (r *M20260812000006DropConfirmedAtFromRemindersTable) Signature() string {
	return "20260812000006_drop_confirmed_at_from_reminders_table"
}

// Up Run the migrations.
//
// confirmed_at existed to record that the "یادآور ثبت شد" message reached the
// user when they created a reminder. That message is gone — a reminder now
// produces exactly one message, the reminder itself at remind_at, and the fact
// that it was saved shows on the home dashboard instead. Nothing writes or
// reads the column any more.
func (r *M20260812000006DropConfirmedAtFromRemindersTable) Up() error {
	if !facades.Schema().HasTable("reminders") {
		return nil
	}
	if !facades.Schema().HasColumn("reminders", "confirmed_at") {
		return nil
	}

	return facades.Schema().Table("reminders", func(table schema.Blueprint) {
		table.DropColumn("confirmed_at")
	})
}

// Down Reverse the migrations.
func (r *M20260812000006DropConfirmedAtFromRemindersTable) Down() error {
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
