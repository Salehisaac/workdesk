package models

import (
	"github.com/goravel/framework/database/orm"
	"github.com/goravel/framework/support/carbon"
)

// Decision — «مصوبه». What a session produced: one commitment, owed by one
// person, by one day.
//
// Not a Job. A job belongs to a list on a project board and moves through six
// states; a decision's entire lifecycle is open → done (or canceled), and its
// context is the meeting it was taken in rather than a board.
type Decision struct {
	orm.Model
	// Null when the meeting it came out of has since been deleted, or when a
	// resolution is recorded outside a session.
	SessionId *uint `gorm:"column:session_id"`
	// Which «دستور جلسه» it came out of, when it came out of one — a room decides
	// things nobody put on the running order. Null too once that item is deleted:
	// the heading goes, the commitment stays.
	AgendaId    *uint  `gorm:"column:agenda_id"`
	OwnerRefId  string `gorm:"column:owner_ref_id"`
	Title       string
	Description *string
	DueAt       *carbon.DateTime `gorm:"column:due_at"`
	// Opaque picked-item reference plus its denormalized display name — the same
	// bargain project_members makes, so nothing here joins against data WorkDesk
	// doesn't own.
	AssigneeRefId *string `gorm:"column:assignee_ref_id"`
	AssigneeName  *string `gorm:"column:assignee_name"`
	Status        string  `gorm:"column:status"`
}

func (Decision) TableName() string {
	return "decisions"
}

// Mirrors DECISION_STATUS_LABEL in the frontend's modules/meeting/types.ts.
const (
	DecisionStatusOpen     = "open"
	DecisionStatusDone     = "done"
	DecisionStatusCanceled = "canceled"
)

// DecisionStatuses is the whole set, for validating what a PATCH may set.
var DecisionStatuses = []string{
	DecisionStatusOpen,
	DecisionStatusDone,
	DecisionStatusCanceled,
}
