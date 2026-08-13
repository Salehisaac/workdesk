package models

import (
	"github.com/goravel/framework/database/orm"
)

// Note — «یادداشت». A private, plain piece of writing filed under the day it
// was written on. Like a Reminder it belongs to a person rather than a project;
// unlike a Reminder it carries no time of its own, because CreatedAt already is
// the only date a note has (see the migration).
type Note struct {
	orm.Model
	OwnerRefId string `gorm:"column:owner_ref_id"`
	Title      string
	Body       *string
	// Null when the note isn't filed under a project, which is the common case.
	ProjectId *uint `gorm:"column:project_id"`
}

func (Note) TableName() string {
	return "notes"
}
