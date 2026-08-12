package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260812000003CreateJobRelationsTables struct{}

// Signature The unique signature for the migration.
func (r *M20260812000003CreateJobRelationsTables) Signature() string {
	return "20260812000003_create_job_relations_tables"
}

// Up Run the migrations. The three tables that hang off a job — who it's
// assigned to, which tags it carries, and its checklist. Grouped into one
// migration because they're created together and are meaningless apart.
func (r *M20260812000003CreateJobRelationsTables) Up() error {
	if !facades.Schema().HasTable("job_assignees") {
		if err := facades.Schema().Create("job_assignees", func(table schema.Blueprint) {
			table.ID()
			table.UnsignedBigInteger("job_id")
			// The picked-item id, matching project_members.ref_id — display
			// name and username stay in project_members so a member renamed
			// there doesn't leave stale copies on every job they're on.
			table.String("ref_id")
			table.TimestampsTz()

			table.Foreign("job_id").References("id").On("project_jobs").CascadeOnDelete()
			table.Unique("job_id", "ref_id")
		}); err != nil {
			return err
		}
	}

	if !facades.Schema().HasTable("job_tags") {
		if err := facades.Schema().Create("job_tags", func(table schema.Blueprint) {
			table.ID()
			table.UnsignedBigInteger("job_id")
			table.UnsignedBigInteger("tag_id")
			table.TimestampsTz()

			table.Foreign("job_id").References("id").On("project_jobs").CascadeOnDelete()
			table.Foreign("tag_id").References("id").On("project_tags").CascadeOnDelete()
			table.Unique("job_id", "tag_id")
		}); err != nil {
			return err
		}
	}

	if !facades.Schema().HasTable("job_checklist_items") {
		if err := facades.Schema().Create("job_checklist_items", func(table schema.Blueprint) {
			table.ID()
			table.UnsignedBigInteger("job_id")
			table.String("text")
			table.Boolean("done").Default(false)
			// Explicit ordering — the checklist is a sequence the author typed,
			// not a set, and insertion order isn't guaranteed on read.
			table.UnsignedBigInteger("position").Default(0)
			table.TimestampsTz()

			table.Foreign("job_id").References("id").On("project_jobs").CascadeOnDelete()
			table.Index("job_id")
		}); err != nil {
			return err
		}
	}

	return nil
}

// Down Reverse the migrations.
func (r *M20260812000003CreateJobRelationsTables) Down() error {
	if err := facades.Schema().DropIfExists("job_checklist_items"); err != nil {
		return err
	}
	if err := facades.Schema().DropIfExists("job_tags"); err != nil {
		return err
	}
	return facades.Schema().DropIfExists("job_assignees")
}
