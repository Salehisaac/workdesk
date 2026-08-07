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
}

func (List) TableName() string {
	return "lists"
}
