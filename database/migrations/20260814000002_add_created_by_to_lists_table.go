package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260814000002AddCreatedByToListsTable struct{}

// Signature The unique signature for the migration.
func (r *M20260814000002AddCreatedByToListsTable) Signature() string {
	return "20260814000002_add_created_by_to_lists_table"
}

// Up Run the migrations.
//
// Who made the list — the column project_jobs has carried since it was created,
// arriving on lists now that it decides something. Anyone in a project may add a
// list; only the person who added it and the project's creator may remove it
// (ProjectListController.Destroy), and until now there was nothing on the row to
// answer the first half of that.
//
// Defaulted to "" rather than nullable, because every read of it is a comparison
// against the caller's id and an empty string can't match one. Rows that predate
// this column therefore fall to the project's creator alone, which is the safe
// direction for a permission to fail in.
func (r *M20260814000002AddCreatedByToListsTable) Up() error {
	if !facades.Schema().HasTable("lists") {
		return nil
	}
	if facades.Schema().HasColumn("lists", "created_by") {
		return nil
	}

	return facades.Schema().Table("lists", func(table schema.Blueprint) {
		table.String("created_by").Default("")
	})
}

// Down Reverse the migrations.
func (r *M20260814000002AddCreatedByToListsTable) Down() error {
	if !facades.Schema().HasTable("lists") {
		return nil
	}

	return facades.Schema().Table("lists", func(table schema.Blueprint) {
		table.DropColumn("created_by")
	})
}
