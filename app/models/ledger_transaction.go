package models

import (
	"github.com/goravel/framework/database/orm"
	"github.com/goravel/framework/support/carbon"
)

// LedgerTransaction — one line of a «دفتر مالی»: an amount that moved, on a
// day, in one direction.
//
// The sign lives in Type, never in Amount. Storing expenses as negative numbers
// would make «مجموع هزینه» a sum over a filtered subset either way, and would
// let a single bad row quietly flip a balance; keeping the amount unsigned means
// a transaction cannot express "negative income" at all.
type LedgerTransaction struct {
	orm.Model
	LedgerId uint `gorm:"column:ledger_id"`
	// Who wrote the line down — not who it is about (that is AssigneeRefId).
	OwnerRefId   string `gorm:"column:owner_ref_id"`
	Type         string
	Amount       uint64
	AccountGroup string `gorm:"column:account_group"`
	Description  *string
	// One of this ledger's own sources, or none.
	SourceId *uint `gorm:"column:source_id"`
	// «مسئول» — an opaque picked-item ref plus its denormalized display name.
	// Not constrained to the ledger's members: the picker can reach anyone in
	// the user's contacts, and this is a label on a receipt, not an access grant.
	AssigneeRefId *string `gorm:"column:assignee_ref_id"`
	AssigneeName  *string `gorm:"column:assignee_name"`
	// The day the money moved — what every period report groups by. Not
	// created_at: a receipt is often entered days after the fact.
	OccurredAt *carbon.DateTime `gorm:"column:occurred_at"`

	Tags []LedgerTransactionTag `gorm:"foreignKey:TransactionId"`
}

func (LedgerTransaction) TableName() string {
	return "ledger_transactions"
}

// The two directions. Mirrors LEDGER_TYPE_LABEL in the frontend's
// modules/ledger/types.ts.
const (
	LedgerTypeIncome  = "income"
	LedgerTypeExpense = "expense"
)

var LedgerTypes = []string{LedgerTypeIncome, LedgerTypeExpense}

// «گروه حساب» — the fixed five the transaction form offers, in the order it
// offers them. Mirrors ACCOUNT_GROUP_LABEL in modules/ledger/types.ts:
// سایر | حقوق | پاداش | فروش | انتقال.
//
// Fixed rather than a per-ledger pool because these are accounting categories,
// not names: they mean the same thing in every book, and a report that groups by
// them stays comparable between two ledgers. What varies per book is the source
// («منبع مالی»), which is why that one *is* a pool.
const (
	LedgerGroupOther    = "other"
	LedgerGroupSalary   = "salary"
	LedgerGroupBonus    = "bonus"
	LedgerGroupSales    = "sales"
	LedgerGroupTransfer = "transfer"
)

var LedgerAccountGroups = []string{
	LedgerGroupOther,
	LedgerGroupSalary,
	LedgerGroupBonus,
	LedgerGroupSales,
	LedgerGroupTransfer,
}

// LedgerTransactionTag is the transaction↔ledger_tag pivot, the counterpart of
// JobTag.
type LedgerTransactionTag struct {
	orm.Model
	TransactionId uint `gorm:"column:transaction_id"`
	TagId         uint `gorm:"column:tag_id"`
}

func (LedgerTransactionTag) TableName() string {
	return "ledger_transaction_tags"
}
