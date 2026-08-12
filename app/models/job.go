package models

import (
	"github.com/goravel/framework/database/orm"
	"github.com/goravel/framework/support/carbon"
)

// Job — a «کار» inside a List inside a Project (plan section 8's third level).
// Table is project_jobs, not jobs: Goravel's queue already owns `jobs`.
type Job struct {
	orm.Model
	ProjectId   uint `gorm:"column:project_id"`
	ListId      uint `gorm:"column:list_id"`
	Number      uint
	Title       string
	Description *string
	// The deadline — the only date in the Project→List→Job hierarchy, and so
	// the only thing from it that lands on the calendar. Nil = no deadline.
	DueAt     *carbon.DateTime `gorm:"column:due_at"`
	Status    string
	CreatedBy string `gorm:"column:created_by"`

	Assignees []JobAssignee      `gorm:"foreignKey:JobId"`
	Tags      []JobTag           `gorm:"foreignKey:JobId"`
	Checklist []JobChecklistItem `gorm:"foreignKey:JobId"`
}

func (Job) TableName() string {
	return "project_jobs"
}

// The six states the status sheet offers. Anything else is rejected at the
// controller boundary.
const (
	JobStatusNotStarted = "notStarted"
	JobStatusInProgress = "inProgress"
	JobStatusPaused     = "paused"
	JobStatusCanceled   = "canceled"
	JobStatusDone       = "done"
	JobStatusRejected   = "rejected"
)

var JobStatuses = []string{
	JobStatusNotStarted,
	JobStatusInProgress,
	JobStatusPaused,
	JobStatusCanceled,
	JobStatusDone,
	JobStatusRejected,
}

func IsValidJobStatus(status string) bool {
	for _, allowed := range JobStatuses {
		if allowed == status {
			return true
		}
	}
	return false
}

// JobAssignee references a ProjectMember by its opaque RefId rather than
// copying the display name — one place stays authoritative for who someone is.
type JobAssignee struct {
	orm.Model
	JobId uint   `gorm:"column:job_id"`
	RefId string `gorm:"column:ref_id"`
}

func (JobAssignee) TableName() string {
	return "job_assignees"
}

// JobTag is the job↔project_tag pivot.
type JobTag struct {
	orm.Model
	JobId uint `gorm:"column:job_id"`
	TagId uint `gorm:"column:tag_id"`
}

func (JobTag) TableName() string {
	return "job_tags"
}

type JobChecklistItem struct {
	orm.Model
	JobId    uint `gorm:"column:job_id"`
	Text     string
	Done     bool
	Position uint
}

func (JobChecklistItem) TableName() string {
	return "job_checklist_items"
}
