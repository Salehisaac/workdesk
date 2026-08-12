package models

import (
	"github.com/goravel/framework/database/orm"
)

// ProjectTag — a label scoped to a Project, shared by every Job in every one of
// its Lists. See database/migrations/20260812000001_create_project_tags_table.go.
type ProjectTag struct {
	orm.Model
	ProjectId uint `gorm:"column:project_id"`
	Name      string
	// Null lets the frontend derive a stable colour from the name.
	Color *string
}

func (ProjectTag) TableName() string {
	return "project_tags"
}
