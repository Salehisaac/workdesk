package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260812000004CreateRemindersTable struct{}

// Signature The unique signature for the migration.
func (r *M20260812000004CreateRemindersTable) Signature() string {
	return "20260812000004_create_reminders_table"
}

// Up Run the migrations.
func (r *M20260812000004CreateRemindersTable) Up() error {
	if facades.Schema().HasTable("reminders") {
		return nil
	}

	// A reminder belongs to one person, not to a project — it's the one thing
	// in WorkDesk that's delivered to a private chat rather than a group topic.
	return facades.Schema().Create("reminders", func(table schema.Blueprint) {
		table.ID()
		// The owner's picked-item id, same opaque-reference convention as
		// project_members.ref_id. On this platform it doubles as the chat_id of
		// their DM with the bot (a positive chat_id is a private chat), which
		// is what makes delivery possible without storing anything extra.
		table.String("owner_ref_id")
		table.String("title")
		table.Text("note").Nullable()
		table.DateTimeTz("remind_at")
		// When the bot actually managed to deliver it. Null means "not sent" —
		// either the send failed, or (once reminders fire on schedule) it simply
		// hasn't come due yet. Also the guard against sending the same reminder
		// twice.
		table.DateTimeTz("notified_at").Nullable()
		table.TimestampsTz()

		table.Index("owner_ref_id")
		table.Index("remind_at")
	})
}

// Down Reverse the migrations.
func (r *M20260812000004CreateRemindersTable) Down() error {
	return facades.Schema().DropIfExists("reminders")
}
