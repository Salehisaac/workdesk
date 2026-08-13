package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260813000008CreateLedgerTables struct{}

// Signature The unique signature for the migration.
func (r *M20260813000008CreateLedgerTables) Signature() string {
	return "20260813000008_create_ledger_tables"
}

// Up Run the migrations.
//
// «دفتر مالی» — the ledger and the three small pools that hang off it. Grouped
// into one migration because a ledger without them is unusable: every
// transaction form reads all three the moment it opens.
//
// A ledger is shaped like a session, not like a project: it provisions no
// Rasagram group and owns no topics, so there is no chat_id here. Its members
// are the people who may read and write it, and they find it in their own
// «دفترهای مالی» list rather than through an invite message — which is the one
// way this differs from a session (see the module's section in API_CONTRACT.md).
func (r *M20260813000008CreateLedgerTables) Up() error {
	if !facades.Schema().HasTable("ledgers") {
		if err := facades.Schema().Create("ledgers", func(table schema.Blueprint) {
			table.ID()
			table.String("owner_ref_id")
			table.String("name")
			table.TimestampsTz()

			table.Index("owner_ref_id")
		}); err != nil {
			return err
		}
	}

	if !facades.Schema().HasTable("ledger_members") {
		if err := facades.Schema().Create("ledger_members", func(table schema.Blueprint) {
			table.ID()
			table.UnsignedBigInteger("ledger_id")
			// The same opaque bridge pick() reference project_members and
			// session_members store — never a foreign key into a users table
			// WorkDesk doesn't own.
			table.String("ref_id")
			table.String("ref_source", 20)
			table.String("display_name")
			table.String("username").Nullable()
			table.String("phone").Nullable()
			table.Boolean("online").Default(false)
			table.String("role", 20).Default("member")
			table.TimestampsTz()

			table.Foreign("ledger_id").References("id").On("ledgers").CascadeOnDelete()
			table.Index("ledger_id")
			table.Index("ref_id")
		}); err != nil {
			return err
		}
	}

	if !facades.Schema().HasTable("ledger_tags") {
		if err := facades.Schema().Create("ledger_tags", func(table schema.Blueprint) {
			table.ID()
			table.UnsignedBigInteger("ledger_id")
			table.String("name")
			// Optional, like a project tag's: null means the frontend derives a
			// stable colour from the name, so a tag never renders colourless.
			table.String("color").Nullable()
			table.TimestampsTz()

			table.Foreign("ledger_id").References("id").On("ledgers").CascadeOnDelete()
			table.Unique("ledger_id", "name")
		}); err != nil {
			return err
		}
	}

	if !facades.Schema().HasTable("ledger_sources") {
		// «منبع مالی» — where the money moved through: a cash box, a card, a
		// bank account. Deliberately a per-ledger pool rather than a fixed enum
		// like account_group: an account group is an accounting category and the
		// same five fit every book, but a source is a thing this particular
		// business owns and only its own bookkeeper can name.
		if err := facades.Schema().Create("ledger_sources", func(table schema.Blueprint) {
			table.ID()
			table.UnsignedBigInteger("ledger_id")
			table.String("name")
			table.TimestampsTz()

			table.Foreign("ledger_id").References("id").On("ledgers").CascadeOnDelete()
			table.Unique("ledger_id", "name")
		}); err != nil {
			return err
		}
	}

	return nil
}

// Down Reverse the migrations.
func (r *M20260813000008CreateLedgerTables) Down() error {
	if err := facades.Schema().DropIfExists("ledger_sources"); err != nil {
		return err
	}
	if err := facades.Schema().DropIfExists("ledger_tags"); err != nil {
		return err
	}
	if err := facades.Schema().DropIfExists("ledger_members"); err != nil {
		return err
	}
	return facades.Schema().DropIfExists("ledgers")
}
