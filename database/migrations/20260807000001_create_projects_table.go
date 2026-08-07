package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260807000001CreateProjectsTable struct{}

// Signature The unique signature for the migration.
func (r *M20260807000001CreateProjectsTable) Signature() string {
	return "20260807000001_create_projects_table"
}

// Up Run the migrations.
func (r *M20260807000001CreateProjectsTable) Up() error {
	if facades.Schema().HasTable("projects") {
		return nil
	}

	return facades.Schema().Create("projects", func(table schema.Blueprint) {
		table.ID()
		table.String("name")
		table.String("avatar_url").Nullable()
		// "private" | "public" — plan section 8.
		table.String("visibility", 20)
		// Public-project join link segment; nullable (private projects have none).
		table.String("join_slug").Nullable()
		// Opaque external topic-group chat id (plan section 8) — nullable until
		// the group is created client-side via the bridge.
		table.String("chat_id").Nullable()
		// Polymorphic "what parent context is this Project attached to"
		// (plan section 6) — deliberately NOT a foreign key into any table
		// WorkDesk doesn't own (constraint #3: no gRPC to teamgram-server).
		table.String("owner_type", 40)
		table.String("owner_id")
		table.TimestampsTz()

		table.Unique("join_slug")
		table.Index("owner_type", "owner_id")
	})
}

// Down Reverse the migrations.
func (r *M20260807000001CreateProjectsTable) Down() error {
	return facades.Schema().DropIfExists("projects")
}
