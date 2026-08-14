package projectfeed

import (
	"strings"
	"testing"

	"github.com/goravel/framework/support/carbon"
	"github.com/stretchr/testify/assert"

	"goravel/app/models"
	"goravel/app/support/jalali"
)

// The start parameters are half of a contract whose other half is in the
// frontend's startParamRoute() — which splits on hyphens and rejects any
// segment that isn't digits. Anything else here lands a member on the home page
// instead of on the thing the message was about.
func TestStartParams(t *testing.T) {
	assert.Equal(t, "project-7", ProjectStartParam(7))
	assert.Equal(t, "list-7-12", ListStartParam(7, 12))
	assert.Equal(t, "job-7-34", JobStartParam(7, 34))
}

func TestJobMessage(t *testing.T) {
	dueAt := carbon.NewDateTime(carbon.Parse("2026-10-03T03:00:00Z"))
	job := &models.Job{Number: 2, Title: "تحویل طرح نهایی", DueAt: dueAt}
	list := &models.List{Name: "کارهای این هفته"}

	message := JobMessage(job, list, []string{"علی رضایی", "مریم توکلی"}, "https://app.example/?startapp=job-7-34")

	// The list is named in the heading even though the message lands in that
	// list's own topic: the same text is what a notification preview shows,
	// outside the topic it was posted in.
	assert.Contains(t, message, "«کارهای این هفته»")
	// «#۲» — the label the board puts on the card, in the digits it uses.
	assert.Contains(t, message, "#۲ تحویل طرح نهایی")
	// The deadline as the person who set it saw it, not as it is stored (UTC).
	assert.Contains(t, message, "🕘 مهلت: "+jalali.FormatDateTime(dueAt.StdTime()))
	assert.Contains(t, message, "👤 علی رضایی، مریم توکلی")
	assert.True(t, strings.HasSuffix(message, "\nhttps://app.example/?startapp=job-7-34"))
}

// A job with neither deadline nor assignees must not leave the blank lines
// those would have filled behind them.
func TestJobMessageWithoutDetails(t *testing.T) {
	job := &models.Job{Number: 11, Title: "پیگیری فاکتور"}
	list := &models.List{Name: "مالی"}

	message := JobMessage(job, list, nil, "https://app.example/?startapp=job-7-34")

	assert.Equal(t, "🆕 کار جدید در «مالی»\n\n#۱۱ پیگیری فاکتور\n\nبرای باز کردن کار در اپ:\nhttps://app.example/?startapp=job-7-34", message)
}

// An unconfigured mini app URL (invite.Link returning "") costs the link, not
// the announcement — and never leaves a label pointing at nothing.
func TestMessagesWithoutLink(t *testing.T) {
	project := ProjectMessage(&models.Project{Name: "پروژه تست"}, "")
	assert.Contains(t, project, "«پروژه تست»")
	assert.NotContains(t, project, "برای باز کردن")

	list := ListMessage(&models.List{Name: "مالی"}, "")
	assert.Contains(t, list, "«مالی»")
	assert.NotContains(t, list, "برای باز کردن")

	job := JobMessage(&models.Job{Number: 1, Title: "کار"}, &models.List{Name: "مالی"}, nil, "")
	assert.NotContains(t, job, "برای باز کردن")
}

// Assignees are stored as opaque RefIds; the readable name lives on the
// project's membership. Anyone the project can't name is left out rather than
// printed as a number.
func TestAssigneeNames(t *testing.T) {
	project := &models.Project{Members: []models.ProjectMember{
		{RefId: "101", DisplayName: "علی رضایی"},
		{RefId: "102", DisplayName: "  "},
	}}
	job := &models.Job{Assignees: []models.JobAssignee{
		{RefId: "101"},
		{RefId: "102"},
		{RefId: "999"},
	}}

	assert.Equal(t, []string{"علی رضایی"}, assigneeNames(project, job))
	assert.Nil(t, assigneeNames(project, &models.Job{}))
}
