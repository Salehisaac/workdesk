package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260807000003CreateListsTable struct{}

// Signature The unique signature for the migration.
func (r *M20260807000003CreateListsTable) Signature() string {
	return "20260807000003_create_lists_table"
}

// Up Run the migrations.
func (r *M20260807000003CreateListsTable) Up() error {
	if facades.Schema().HasTable("lists") {
		return nil
	}

	return facades.Schema().Create("lists", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("project_id")
		table.String("name")
		// Opaque forum-topic reference inside the project's chat (plan
		// section 8) — nullable until the Bot API topic actually exists.
		table.String("topic_id").Nullable()
		table.TimestampsTz()

		table.Foreign("project_id").References("id").On("projects").CascadeOnDelete()
		table.Index("project_id")
	})
}

// Down Reverse the migrations.
func (r *M20260807000003CreateListsTable) Down() error {
	return facades.Schema().DropIfExists("lists")
}
