package models

import (
	"github.com/goravel/framework/database/orm"
	"github.com/goravel/framework/support/carbon"
)

// Ledger — «دفتر مالی», the unit of the money module.
//
// The third thing in WorkDesk that gathers people without provisioning a group,
// and the second that invites them by message: a project creates a Rasagram
// supergroup whose appearance in the chat list is the invitation, while a
// session and a ledger have no group to appear anywhere, so each messages its
// members a deep link instead (app/services/ledgerinvite). That is why there is
// no ChatId here and no topics — but there is an invite.
//
// What a ledger owns is a set of transactions and the two small pools they draw
// from — its tags and its «منابع مالی». The account groups are NOT one of those
// pools: they are a fixed five (see LedgerAccountGroups), because an accounting
// category means the same thing in every book while a source is a cash box only
// this business has.
type Ledger struct {
	orm.Model
	OwnerRefId string `gorm:"column:owner_ref_id"`
	Name       string

	Members []LedgerMember `gorm:"foreignKey:LedgerId"`
	Tags    []LedgerTag    `gorm:"foreignKey:LedgerId"`
	Sources []LedgerSource `gorm:"foreignKey:LedgerId"`
}

func (Ledger) TableName() string {
	return "ledgers"
}

// LedgerMember stores a picked bridge item verbatim, exactly as ProjectMember
// and SessionMember do — including SessionMember's NotifiedAt, for the same
// reason it has one: with no group to add anyone to, the invite message is the
// only thing that told them the book exists.
type LedgerMember struct {
	orm.Model
	LedgerId    uint   `gorm:"column:ledger_id"`
	RefId       string `gorm:"column:ref_id"`
	RefSource   string `gorm:"column:ref_source"`
	DisplayName string `gorm:"column:display_name"`
	Username    *string
	Phone       *string
	Online      bool
	Role        string
	// When the invite DM actually reached them; null when it didn't. The bot can
	// only open a chat with someone who has already started it, so this being
	// null is an ordinary outcome, not necessarily an error.
	NotifiedAt *carbon.DateTime `gorm:"column:notified_at"`
}

func (LedgerMember) TableName() string {
	return "ledger_members"
}

const (
	LedgerMemberRoleOwner  = "owner"
	LedgerMemberRoleMember = "member"
)

// LedgerTag is the ledger-scoped tag pool, the exact counterpart of ProjectTag:
// a tag written while recording one transaction is immediately available to
// every other transaction in the same book.
type LedgerTag struct {
	orm.Model
	LedgerId uint `gorm:"column:ledger_id"`
	Name     string
	Color    *string
}

func (LedgerTag) TableName() string {
	return "ledger_tags"
}

// LedgerSource — «منبع مالی». Where the money moved through, named by whoever
// keeps this book: «صندوق فروشگاه», «کارت بانک ملت», «تنخواه».
type LedgerSource struct {
	orm.Model
	LedgerId uint `gorm:"column:ledger_id"`
	Name     string
}

func (LedgerSource) TableName() string {
	return "ledger_sources"
}
