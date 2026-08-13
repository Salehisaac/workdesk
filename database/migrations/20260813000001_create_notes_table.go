package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260813000001CreateNotesTable struct{}

// Signature The unique signature for the migration.
func (r *M20260813000001CreateNotesTable) Signature() string {
	return "20260813000001_create_notes_table"
}

// Up Run the migrations.
//
// A note belongs to a person and to one calendar day — the day it was written
// on. There is deliberately no `noted_on` column: notes can only be written for
// the current day (see NoteController.Store), so created_at *is* the day, and a
// second column could only ever drift from it.
func (r *M20260813000001CreateNotesTable) Up() error {
	if facades.Schema().HasTable("notes") {
		return nil
	}

	return facades.Schema().Create("notes", func(table schema.Blueprint) {
		table.ID()
		// The owner's picked-item id, same opaque-reference convention as
		// reminders.owner_ref_id — a note is private to whoever wrote it.
		table.String("owner_ref_id")
		table.String("title")
		table.Text("body").Nullable()
		// Optional filing. Null is the normal case: a note is personal first,
		// and only sometimes about a project.
		table.UnsignedBigInteger("project_id").Nullable()
		table.TimestampsTz()

		// NullOnDelete, not cascade: the note is the user's own writing, so
		// losing the project it was filed under must not take it with it.
		table.Foreign("project_id").References("id").On("projects").NullOnDelete()
		table.Index("owner_ref_id")
		// The day index — every read is "this owner's notes, newest first".
		table.Index("created_at")
	})
}

// Down Reverse the migrations.
func (r *M20260813000001CreateNotesTable) Down() error {
	return facades.Schema().DropIfExists("notes")
}
