package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260813000006AddAgendaToDecisionsTable struct{}

// Signature The unique signature for the migration.
func (r *M20260813000006AddAgendaToDecisionsTable) Signature() string {
	return "20260813000006_add_agenda_to_decisions_table"
}

// Up Run the migrations.
//
// Two columns the مصوبه sheet grew once the meeting had a running order to hang
// things on:
//
//	description — the resolution's own text, under its one-line title. A
//	              resolution is a sentence people are held to; the room's reasons
//	              for it were going in the title until there was somewhere else.
//	agenda_id   — which «دستور جلسه» it came out of. Optional, because a room
//	              decides things nobody put on the agenda.
//
// NullOnDelete rather than cascade: deleting an agenda item removes the heading
// a resolution sat under, not the commitment somebody made.
func (r *M20260813000006AddAgendaToDecisionsTable) Up() error {
	if !facades.Schema().HasTable("decisions") {
		return nil
	}

	if !facades.Schema().HasColumn("decisions", "description") {
		if err := facades.Schema().Table("decisions", func(table schema.Blueprint) {
			table.Text("description").Nullable()
		}); err != nil {
			return err
		}
	}

	if facades.Schema().HasColumn("decisions", "agenda_id") {
		return nil
	}

	return facades.Schema().Table("decisions", func(table schema.Blueprint) {
		table.UnsignedBigInteger("agenda_id").Nullable()
		table.Foreign("agenda_id").References("id").On("session_agendas").NullOnDelete()
		table.Index("agenda_id")
	})
}

// Down Reverse the migrations.
func (r *M20260813000006AddAgendaToDecisionsTable) Down() error {
	if !facades.Schema().HasTable("decisions") {
		return nil
	}

	return facades.Schema().Table("decisions", func(table schema.Blueprint) {
		table.DropForeign("agenda_id")
		table.DropColumn("agenda_id", "description")
	})
}
