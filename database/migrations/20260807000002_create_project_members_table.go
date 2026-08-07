package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260807000002CreateProjectMembersTable struct{}

// Signature The unique signature for the migration.
func (r *M20260807000002CreateProjectMembersTable) Signature() string {
	return "20260807000002_create_project_members_table"
}

// Up Run the migrations.
func (r *M20260807000002CreateProjectMembersTable) Up() error {
	if facades.Schema().HasTable("project_members") {
		return nil
	}

	return facades.Schema().Create("project_members", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("project_id")
		// Opaque bridge pick() reference (plan section 4/6) — never a foreign
		// key into a contacts/users table WorkDesk doesn't own.
		table.String("ref_id")
		// users | contacts | groups | channels | bots | recentChats | favorites
		table.String("ref_source", 20)
		table.String("display_name")
		table.String("username").Nullable()
		table.String("phone").Nullable()
		table.Boolean("online").Default(false)
		// "owner" | "member" — the authenticated creator is "owner", everyone
		// else picked in the wizard is "member" (API_CONTRACT.md).
		table.String("role", 20).Default("member")
		table.TimestampsTz()

		table.Foreign("project_id").References("id").On("projects").CascadeOnDelete()
		table.Index("project_id")
	})
}

// Down Reverse the migrations.
func (r *M20260807000002CreateProjectMembersTable) Down() error {
	return facades.Schema().DropIfExists("project_members")
}
