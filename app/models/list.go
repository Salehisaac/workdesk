package models

import (
	"github.com/goravel/framework/database/orm"
)

// List — field-complete for what plan section 8 needs (the topic-group
// lifecycle); everything else about lists/jobs is still out of scope.
type List struct {
	orm.Model
	ProjectId uint `gorm:"column:project_id"`
	Name      string
	TopicId   *string `gorm:"column:topic_id"`
	// One of Telegram's 6 standard forum-topic icon colors (see
	// app/services/botapi's ForumTopicColors), or nil for the platform's
	// default icon. Opaque — never interpreted server-side.
	IconColor *int64 `gorm:"column:icon_color"`
}

func (List) TableName() string {
	return "lists"
}
