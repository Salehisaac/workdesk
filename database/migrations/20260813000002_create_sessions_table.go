package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260813000002CreateSessionsTable struct{}

// Signature The unique signature for the migration.
func (r *M20260813000002CreateSessionsTable) Signature() string {
	return "20260813000002_create_sessions_table"
}

// Up Run the migrations.
//
// A «جلسه» is the meeting repository's unit: a titled event at a known instant,
// with the people who were invited to it (session_members) and whatever came out
// of it (decisions).
//
// Deliberately NOT a project: a session has no chat_id column and provisions no
// group. Where a Project *is* a Rasagram supergroup, a session is only a row —
// the members hear about it through a direct message carrying a deep link back
// into the mini app (see app/services/sessioninvite). That difference is the
// whole reason this table exists instead of reusing projects.
func (r *M20260813000002CreateSessionsTable) Up() error {
	if facades.Schema().HasTable("sessions") {
		return nil
	}

	return facades.Schema().Create("sessions", func(table schema.Blueprint) {
		table.ID()
		// Whoever called POST /sessions. Same opaque picked-item convention as
		// notes.owner_ref_id / project_members.ref_id — never a foreign key into
		// a users table WorkDesk doesn't own.
		table.String("owner_ref_id")
		table.String("title")
		// Optional filing under a project the owner belongs to, mirroring
		// notes.project_id. Null is the normal case: most meetings are their own
		// context, and the ones that aren't want to be findable from the board.
		table.UnsignedBigInteger("project_id").Nullable()
		// The instant the meeting starts. Stored absolute (like reminders.remind_at)
		// so ordering and "has it happened yet" are plain comparisons; the Persian
		// wall clock is a rendering concern (app/support/jalali).
		table.DateTimeTz("starts_at")
		// Where it is held. Null when is_online — being online is its own kind of
		// location, not a room named "online".
		table.String("location").Nullable()
		table.Boolean("is_online").Default(false)
		// notStarted | inProgress | done | canceled — the set in the frontend's
		// modules/meeting/types.ts (SESSION_STATUS_LABEL), which is authoritative.
		table.String("status", 20).Default("notStarted")
		table.TimestampsTz()

		// NullOnDelete for the same reason notes use it: deleting a project must
		// not delete the record that a meeting happened.
		table.Foreign("project_id").References("id").On("projects").NullOnDelete()
		table.Index("owner_ref_id")
		// Every list read is "sessions I'm in, by when they start".
		table.Index("starts_at")
	})
}

// Down Reverse the migrations.
func (r *M20260813000002CreateSessionsTable) Down() error {
	return facades.Schema().DropIfExists("sessions")
}
