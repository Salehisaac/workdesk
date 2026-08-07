package models

import (
	"github.com/goravel/framework/database/orm"
)

// Project — see database/migrations/20260807000001_create_projects_table.go
// for column notes (OwnerType/OwnerID vs ChatID are two different concerns,
// plan section 8).
type Project struct {
	orm.Model
	Name       string
	AvatarUrl  *string `gorm:"column:avatar_url"`
	Visibility string
	JoinSlug   *string `gorm:"column:join_slug"`
	ChatId     *string `gorm:"column:chat_id"`
	OwnerType  string  `gorm:"column:owner_type"`
	OwnerId    string  `gorm:"column:owner_id"`

	Members []ProjectMember `gorm:"foreignKey:ProjectId"`
	Lists   []List          `gorm:"foreignKey:ProjectId"`
}

func (Project) TableName() string {
	return "projects"
}

const (
	ProjectVisibilityPrivate = "private"
	ProjectVisibilityPublic  = "public"
)

const (
	ProjectMemberRoleOwner  = "owner"
	ProjectMemberRoleMember = "member"
)
