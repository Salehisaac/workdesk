package models

import (
	"github.com/goravel/framework/database/orm"
)

// ProjectMember stores a picked bridge item verbatim (plan section 4) —
// RefId/RefSource are opaque, never a foreign key into a contacts/users
// table WorkDesk doesn't own.
type ProjectMember struct {
	orm.Model
	ProjectId   uint   `gorm:"column:project_id"`
	RefId       string `gorm:"column:ref_id"`
	RefSource   string `gorm:"column:ref_source"`
	DisplayName string `gorm:"column:display_name"`
	Username    *string
	Phone       *string
	Online      bool
	Role        string
}

func (ProjectMember) TableName() string {
	return "project_members"
}
