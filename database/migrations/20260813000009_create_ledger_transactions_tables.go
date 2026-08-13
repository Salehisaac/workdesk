package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260813000009CreateLedgerTransactionsTables struct{}

// Signature The unique signature for the migration.
func (r *M20260813000009CreateLedgerTransactionsTables) Signature() string {
	return "20260813000009_create_ledger_transactions_tables"
}

// Up Run the migrations.
//
// A «تراکنش» is one line of the book: an amount that moved, on a day, in one
// direction. Everything else on it — the account group, the source, the tags,
// the person responsible — exists so the same rows can be re-cut into the
// module's three views (مجموع / درآمدها / هزینه‌ها) and its periodic reports
// without a second table.
func (r *M20260813000009CreateLedgerTransactionsTables) Up() error {
	if !facades.Schema().HasTable("ledger_transactions") {
		if err := facades.Schema().Create("ledger_transactions", func(table schema.Blueprint) {
			table.ID()
			table.UnsignedBigInteger("ledger_id")
			// Who wrote the line down. Distinct from assignee_ref_id below, which
			// is who the money is *about* — the bookkeeper is rarely the مسئول.
			table.String("owner_ref_id")
			// income | expense — LEDGER_TYPE_LABEL in the frontend's
			// modules/ledger/types.ts.
			table.String("type", 10)
			// Toman, whole units. An unsigned integer rather than a decimal on
			// purpose: Iranian retail prices carry no sub-Toman part, and holding
			// money as an integer keeps every sum on this table exact. The sign is
			// carried by `type`, never by the amount.
			table.UnsignedBigInteger("amount")
			// other | salary | bonus | sales | transfer — «گروه حساب», the fixed
			// five the transaction form offers.
			table.String("account_group", 20).Default("other")
			table.Text("description").Nullable()
			// «منبع مالی» — one of this ledger's own sources, or none.
			table.UnsignedBigInteger("source_id").Nullable()
			// «مسئول» — the picked person the line is about, stored as an opaque
			// ref beside its denormalized display name, the same bargain
			// project_members and decisions make. Not required to be a member of
			// the ledger: the picker can reach anyone in the user's contacts, and
			// the name here is a label on a receipt, not an access grant.
			table.String("assignee_ref_id").Nullable()
			table.String("assignee_name").Nullable()
			// The day the money actually moved, which is not necessarily the day
			// it was written down — a period report groups by this and by nothing
			// else. Offset-carrying, like every other timestamp the client sends.
			table.DateTimeTz("occurred_at")
			table.TimestampsTz()

			table.Foreign("ledger_id").References("id").On("ledgers").CascadeOnDelete()
			// NullOnDelete: deleting a source must not erase the transactions that
			// went through it — the money still moved, it just stops being filed
			// under a source that no longer exists.
			table.Foreign("source_id").References("id").On("ledger_sources").NullOnDelete()
			table.Index("ledger_id")
			table.Index("occurred_at")
		}); err != nil {
			return err
		}
	}

	if !facades.Schema().HasTable("ledger_transaction_tags") {
		if err := facades.Schema().Create("ledger_transaction_tags", func(table schema.Blueprint) {
			table.ID()
			table.UnsignedBigInteger("transaction_id")
			table.UnsignedBigInteger("tag_id")
			table.TimestampsTz()

			table.Foreign("transaction_id").References("id").On("ledger_transactions").CascadeOnDelete()
			table.Foreign("tag_id").References("id").On("ledger_tags").CascadeOnDelete()
			table.Unique("transaction_id", "tag_id")
		}); err != nil {
			return err
		}
	}

	return nil
}

// Down Reverse the migrations.
func (r *M20260813000009CreateLedgerTransactionsTables) Down() error {
	if err := facades.Schema().DropIfExists("ledger_transaction_tags"); err != nil {
		return err
	}
	return facades.Schema().DropIfExists("ledger_transactions")
}
