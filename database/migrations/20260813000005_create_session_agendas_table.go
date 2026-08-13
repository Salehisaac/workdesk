package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260813000005CreateSessionAgendasTable struct{}

// Signature The unique signature for the migration.
func (r *M20260813000005CreateSessionAgendasTable) Signature() string {
	return "20260813000005_create_session_agendas_table"
}

// Up Run the migrations.
//
// A «دستور جلسه» is a line on the meeting's running order — the things the room
// is there to get through. It is the counterpart of a «مصوبه» and not a variant
// of it: an agenda item is written before the meeting and consumes the meeting's
// own time (duration_minutes), while a decision comes out of it and lands on
// somebody's calendar afterwards (decisions.due_at).
//
// CascadeOnDelete, unlike decisions.session_id: a resolution outlives the record
// of the meeting that produced it, but an agenda item is nothing but that
// meeting's running order and has no meaning once it is gone.
func (r *M20260813000005CreateSessionAgendasTable) Up() error {
	if facades.Schema().HasTable("session_agendas") {
		return nil
	}

	return facades.Schema().Create("session_agendas", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("session_id")
		table.String("owner_ref_id")
		table.String("title")
		table.Text("description").Nullable()
		// Minutes, so the hour/minute wheel stores one number rather than two
		// columns that can disagree. Null when nobody budgeted the item.
		table.UnsignedInteger("duration_minutes").Nullable()
		// Who is to carry it — «مسئول اجرایی». Denormalized display name beside
		// the opaque ref, same bargain session_members makes: no join into data
		// WorkDesk doesn't own.
		table.String("assignee_ref_id").Nullable()
		table.String("assignee_name").Nullable()
		table.TimestampsTz()

		table.Foreign("session_id").References("id").On("sessions").CascadeOnDelete()
		table.Index("session_id")
	})
}

// Down Reverse the migrations.
func (r *M20260813000005CreateSessionAgendasTable) Down() error {
	return facades.Schema().DropIfExists("session_agendas")
}
