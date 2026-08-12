package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260812000002CreateProjectJobsTable struct{}

// Signature The unique signature for the migration.
func (r *M20260812000002CreateProjectJobsTable) Signature() string {
	return "20260812000002_create_project_jobs_table"
}

// Up Run the migrations.
//
// Named project_jobs, not jobs: `jobs` is already Goravel's own queue table
// (see 20210101000001_create_jobs_table.go). The model is still models.Job —
// only the table name has to dodge the collision.
func (r *M20260812000002CreateProjectJobsTable) Up() error {
	if facades.Schema().HasTable("project_jobs") {
		return nil
	}

	return facades.Schema().Create("project_jobs", func(table schema.Blueprint) {
		table.ID()
		// Denormalized from the list so "every job with a deadline, across all
		// my projects" (what the home calendar draws) is one indexed query
		// instead of a join through lists.
		table.UnsignedBigInteger("project_id")
		table.UnsignedBigInteger("list_id")
		// Per-project sequence, shown as «#۲». Assigned at insert time.
		table.UnsignedBigInteger("number").Default(0)
		table.String("title")
		table.Text("description").Nullable()
		// The deadline. Nullable — a job without one simply never appears on
		// the calendar. Timestamptz so the stored instant is unambiguous.
		table.DateTimeTz("due_at").Nullable()
		table.String("status")
		// The picked-item id of whoever created it (ProjectMember.RefId), same
		// opaque-reference convention as project_members.
		table.String("created_by")
		table.TimestampsTz()

		table.Foreign("project_id").References("id").On("projects").CascadeOnDelete()
		table.Foreign("list_id").References("id").On("lists").CascadeOnDelete()
		table.Index("project_id")
		table.Index("list_id")
		table.Index("due_at")
	})
}

// Down Reverse the migrations.
func (r *M20260812000002CreateProjectJobsTable) Down() error {
	return facades.Schema().DropIfExists("project_jobs")
}
