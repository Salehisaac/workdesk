package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260814000001AddNotifiedAtToLedgerMembersTable struct{}

// Signature The unique signature for the migration.
func (r *M20260814000001AddNotifiedAtToLedgerMembersTable) Signature() string {
	return "20260814000001_add_notified_at_to_ledger_members_table"
}

// Up Run the migrations.
//
// The column session_members has had since it was created, arriving one table
// late — a ledger now invites its members the way a session does.
//
// The original table deliberately had no counterpart, because creating a ledger
// sent nothing: its members were expected to find the book in their own list.
// That only works for someone who already knows the book exists, which nobody
// picked into it does. Now that they're messaged a deep link
// (app/services/ledgerinvite), whether that message arrived has to be recorded —
// the bot can only open a chat with someone who has started it, so a member who
// never has legitimately stays null, and the create screen says so instead of
// implying everyone was told.
func (r *M20260814000001AddNotifiedAtToLedgerMembersTable) Up() error {
	if !facades.Schema().HasTable("ledger_members") {
		return nil
	}
	if facades.Schema().HasColumn("ledger_members", "notified_at") {
		return nil
	}

	return facades.Schema().Table("ledger_members", func(table schema.Blueprint) {
		table.DateTimeTz("notified_at").Nullable()
	})
}

// Down Reverse the migrations.
func (r *M20260814000001AddNotifiedAtToLedgerMembersTable) Down() error {
	if !facades.Schema().HasTable("ledger_members") {
		return nil
	}

	return facades.Schema().Table("ledger_members", func(table schema.Blueprint) {
		table.DropColumn("notified_at")
	})
}
