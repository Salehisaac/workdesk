package models

import (
	"github.com/goravel/framework/database/orm"
	"github.com/goravel/framework/support/carbon"
)

// Reminder — a private note-to-self with a time on it. Unlike every other
// WorkDesk entity it has no project: it's delivered to the owner's direct chat
// with the bot, not to a group topic.
type Reminder struct {
	orm.Model
	// Doubles as the DM's chat_id — see the migration.
	OwnerRefId string `gorm:"column:owner_ref_id"`
	Title      string
	Note       *string
	RemindAt   *carbon.DateTime `gorm:"column:remind_at"`
	// Set when the reminder fired at RemindAt. Also the dispatcher's
	// "already handled" guard, which is why nothing else may write it.
	NotifiedAt *carbon.DateTime `gorm:"column:notified_at"`
}

func (Reminder) TableName() string {
	return "reminders"
}
