package models

import (
	"github.com/goravel/framework/database/orm"
	"github.com/goravel/framework/support/carbon"
)

// Session — «جلسه», the unit of the meeting repository («مخزن جلسه»).
//
// Shaped like a Project (a title, an avatar-less identity, a member list picked
// through the bridge) and deliberately unlike one in the way that matters: it
// has no ChatId, because creating a session provisions no group. Its members
// learn about it from a direct message carrying a deep link back into the mini
// app — see app/services/sessioninvite.
type Session struct {
	orm.Model
	OwnerRefId string `gorm:"column:owner_ref_id"`
	Title      string
	// Null unless the meeting was filed under a project the owner belongs to.
	ProjectId *uint            `gorm:"column:project_id"`
	StartsAt  *carbon.DateTime `gorm:"column:starts_at"`
	// Where an online meeting actually happens — the conferencing link. Only
	// meaningful alongside IsOnline, and optional even then: a room whose link is
	// circulated elsewhere is still an online meeting. A حضوری session has no
	// counterpart field; see the migration that replaced `location`.
	Url      *string `gorm:"column:url"`
	IsOnline bool    `gorm:"column:is_online"`
	Status   string  `gorm:"column:status"`

	Members []SessionMember `gorm:"foreignKey:SessionId"`
}

func (Session) TableName() string {
	return "sessions"
}

// The four states a session moves through — mirrors SESSION_STATUS_LABEL in the
// frontend's modules/meeting/types.ts.
const (
	SessionStatusNotStarted = "notStarted"
	SessionStatusInProgress = "inProgress"
	SessionStatusDone       = "done"
	SessionStatusCanceled   = "canceled"
)

// SessionStatuses is the whole set, for validating what a PATCH may set.
var SessionStatuses = []string{
	SessionStatusNotStarted,
	SessionStatusInProgress,
	SessionStatusDone,
	SessionStatusCanceled,
}

// SessionMember stores a picked bridge item verbatim, exactly as ProjectMember
// does — plus NotifiedAt, which a project member has no equivalent of because a
// project announces itself by adding people to a group they can see.
type SessionMember struct {
	orm.Model
	SessionId   uint   `gorm:"column:session_id"`
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

func (SessionMember) TableName() string {
	return "session_members"
}

const (
	SessionMemberRoleOwner  = "owner"
	SessionMemberRoleMember = "member"
)
