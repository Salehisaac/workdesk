package models

import (
	"github.com/goravel/framework/database/orm"
)

// SessionAgenda — «دستور جلسه». One item on the meeting's running order: what
// will be discussed, for how long, and who is to carry it.
//
// Not a Decision, and the difference is the direction each faces. A دستور جلسه
// is written *before* the meeting and is spent inside it, so what it carries is
// a duration — a slice of the session's own time. A مصوبه is what came *out* of
// it and reaches past the meeting into somebody's calendar, so what it carries
// is a deadline. That is why one has DurationMinutes and the other DueAt, and
// why they aren't one table with a nullable pair of columns.
//
// A decision may point back at the agenda item it came out of (Decision.AgendaId),
// which is how the session screen groups «چه چیزی مصوب شد» under «سر چه بحثی».
type SessionAgenda struct {
	orm.Model
	SessionId  uint   `gorm:"column:session_id"`
	OwnerRefId string `gorm:"column:owner_ref_id"`
	Title      string
	// Free text, absent far more often than not — the title carries the item.
	Description *string
	// How long it is meant to take, in minutes. Null when nobody budgeted it;
	// the picker offers hours and minutes and stores their sum, so 1:30 is 90.
	DurationMinutes *uint `gorm:"column:duration_minutes"`
	// The «مسئول اجرایی» — one of the session's members. Opaque ref plus the
	// denormalized display name, the same bargain session_members makes.
	AssigneeRefId *string `gorm:"column:assignee_ref_id"`
	AssigneeName  *string `gorm:"column:assignee_name"`
}

func (SessionAgenda) TableName() string {
	return "session_agendas"
}

// AgendaMaxDurationMinutes is a day minus a minute — the largest thing the
// hour/minute wheel can express (23:59), and the ceiling the API validates
// against so a typo'd duration can't outlast the meeting by a week.
const AgendaMaxDurationMinutes = 24*60 - 1
