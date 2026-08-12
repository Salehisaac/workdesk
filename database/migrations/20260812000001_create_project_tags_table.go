package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260812000001CreateProjectTagsTable struct{}

// Signature The unique signature for the migration.
func (r *M20260812000001CreateProjectTagsTable) Signature() string {
	return "20260812000001_create_project_tags_table"
}

// Up Run the migrations.
func (r *M20260812000001CreateProjectTagsTable) Up() error {
	if facades.Schema().HasTable("project_tags") {
		return nil
	}

	// Tags belong to the project, not to the job that first used one: define a
	// tag on any job and every list in that project can pick it up afterwards.
	return facades.Schema().Create("project_tags", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("project_id")
		table.String("name")
		// Optional — the frontend derives a stable colour from the name when
		// this is null, so a tag never renders colourless.
		table.String("color").Nullable()
		table.TimestampsTz()

		table.Foreign("project_id").References("id").On("projects").CascadeOnDelete()
		// One tag name per project; the same name in another project is fine.
		table.Unique("project_id", "name")
	})
}

// Down Reverse the migrations.
func (r *M20260812000001CreateProjectTagsTable) Down() error {
	return facades.Schema().DropIfExists("project_tags")
}
