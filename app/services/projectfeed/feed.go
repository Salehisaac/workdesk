// Package projectfeed announces a project's own milestones in the chat that
// project already IS.
//
// Nothing here is a new notification channel. A Project is a forum-enabled
// supergroup and each of its Lists is a topic inside it (app/services/
// rasagramadmin, botapi.CreateForumTopic), which is why the board's
// «فعالیت‌ها» button hands the user off to a topic rather than to a feed this
// app would have to build and keep in sync. These messages are what makes that
// hand-off worth taking: the group's General topic says the project exists, each
// new topic opens by saying which list it is, and every job filed into a list
// lands in that list's topic — each carrying a link back into the mini app, on
// the screen the message is about.
//
// The links are built the way invites are (app/services/invite): the mini app's
// own URL plus ?startapp=<param>, with the frontend's startParamRoute() as the
// other half of the contract.
//
// Every announcement is best-effort and synchronous — one Bot API call on the
// tail of a create request, the same way sessioninvite sends inside session
// creation. A failure is logged and nothing else: a project, list or job that
// exists but wasn't announced is a missing chat message, not a failed creation,
// and refusing the write would throw away something the user actually made.
package projectfeed

import (
	"fmt"
	"strings"

	"goravel/app/facades"
	"goravel/app/models"
	"goravel/app/services/botapi"
	"goravel/app/services/invite"
	"goravel/app/support/jalali"
)

// The three things a link out of this package can point at, by the `<kind>`
// prefix the frontend matches on (START_PARAM_ROUTES in app/router.tsx). Kept
// as constants on both sides of the wire so the pair can be grepped together —
// same convention as sessioninvite.StartParamPrefix.
const (
	ProjectStartParamPrefix = "project"
	ListStartParamPrefix    = "list"
	JobStartParamPrefix     = "job"
)

// ProjectStartParam opens the project's board.
func ProjectStartParam(projectId uint) string {
	return fmt.Sprintf("%s-%d", ProjectStartParamPrefix, projectId)
}

// ListStartParam opens the board scrolled to one list.
//
// Two ids rather than one, here and in JobStartParam: everything below a
// project is nested under it in the frontend's routes, so a list or job id on
// its own wouldn't say which project's board to open. Hyphen-separated, which
// keeps the whole parameter inside the platform's launch-parameter grammar
// (A-Z, a-z, 0-9, `_`, `-`).
func ListStartParam(projectId, listId uint) string {
	return fmt.Sprintf("%s-%d-%d", ListStartParamPrefix, projectId, listId)
}

// JobStartParam opens one job.
func JobStartParam(projectId, jobId uint) string {
	return fmt.Sprintf("%s-%d-%d", JobStartParamPrefix, projectId, jobId)
}

// link builds the mini app's link for a start parameter, saying so when there
// is none to build. An announcement without a link still reads fine (see
// appendLink), but a deployment where every one of them is linkless is a
// configuration mistake worth finding in the log rather than in a chat.
func link(startParam string) string {
	built := invite.Link(startParam)
	if built == "" {
		facades.Log().Warning("workdesk: services.rasagram.miniapp_url is not configured — the group announcement carries no link")
	}
	return built
}

// appendLink closes a message with the mini app's link, on its own line and
// under a line that says what tapping it opens: every chat client turns a bare
// URL into something tappable, and this is the whole point of the message.
//
// A blank link appends nothing at all, rather than a label pointing at nowhere.
func appendLink(b *strings.Builder, label, url string) {
	if url == "" {
		return
	}
	b.WriteString("\n\n")
	b.WriteString(label)
	b.WriteString("\n")
	b.WriteString(url)
}

// ProjectMessage is what the group's General topic gets: what this group is,
// and how to open it in the app.
func ProjectMessage(project *models.Project, url string) string {
	var b strings.Builder
	b.WriteString("📁 پروژه‌ی «")
	b.WriteString(project.Name)
	b.WriteString("» ساخته شد\n\n")
	b.WriteString("هر لیست این پروژه یک موضوع در همین گروه دارد و کارهای تازه همان‌جا اعلام می‌شوند.")
	appendLink(&b, "برای باز کردن پروژه در اپ:", url)
	return b.String()
}

// ListMessage is a topic's first message — it says which list this topic is,
// which is otherwise only knowable from the topic's own title.
func ListMessage(list *models.List, url string) string {
	var b strings.Builder
	b.WriteString("🗂 لیست «")
	b.WriteString(list.Name)
	b.WriteString("» ساخته شد\n\n")
	b.WriteString("کارهای این لیست از این پس همین‌جا اعلام می‌شوند.")
	appendLink(&b, "برای باز کردن لیست در اپ:", url)
	return b.String()
}

// JobMessage is a new job as someone reading the list's topic needs it: which
// job (its per-project number, the way the board labels it), by when, for whom,
// and how to open it.
//
// assignees are display names already resolved by the caller (assigneeNames) —
// a job stores opaque RefIds, and an id in a chat message means nothing to the
// person reading it.
func JobMessage(job *models.Job, list *models.List, assignees []string, url string) string {
	var b strings.Builder
	b.WriteString("🆕 کار جدید در «")
	b.WriteString(list.Name)
	b.WriteString("»\n\n")
	// «#۲», the same label the board puts on the card.
	b.WriteString(jalali.ToPersianDigits(fmt.Sprintf("#%d ", job.Number)))
	b.WriteString(job.Title)

	if job.DueAt != nil || len(assignees) > 0 {
		b.WriteString("\n")
	}
	if job.DueAt != nil {
		// The stored instant rendered into the display zone (Asia/Tehran), so
		// the deadline reads the way the person who set it saw it — same
		// treatment sessioninvite and the reminder dispatcher give theirs.
		b.WriteString("\n🕘 مهلت: ")
		b.WriteString(jalali.FormatDateTime(job.DueAt.StdTime()))
	}
	if len(assignees) > 0 {
		b.WriteString("\n👤 ")
		b.WriteString(strings.Join(assignees, "، "))
	}

	appendLink(&b, "برای باز کردن کار در اپ:", url)
	return b.String()
}

// AnnounceProject posts into the group's General topic — the one topic that
// isn't a list, and so the place for something about the project as a whole.
//
// Called once, right after the project's rows are written: the group has just
// appeared in every member's chat list, and this is the first thing they read
// in it.
func AnnounceProject(project *models.Project) {
	post(project, "", ProjectMessage(project, link(ProjectStartParam(project.ID))))
}

// AnnounceList posts into the topic that was just created for this list.
func AnnounceList(project *models.Project, list *models.List) {
	topicId, ok := topicOf(list)
	if !ok {
		return
	}
	post(project, topicId, ListMessage(list, link(ListStartParam(project.ID, list.ID))))
}

// AnnounceJob posts into the topic of the list the job was filed into, so the
// topic a member opens from the board reads as that list's activity.
func AnnounceJob(project *models.Project, list *models.List, job *models.Job) {
	topicId, ok := topicOf(list)
	if !ok {
		return
	}
	post(project, topicId, JobMessage(job, list, assigneeNames(project, job), link(JobStartParam(project.ID, job.ID))))
}

// topicOf is the list's topic, if it has one. Creating a list through
// ProjectListController always creates its topic first (a failure there is a
// 502 and no row), so a list without one is a row that predates that — nothing
// to post into, and not an error worth logging on every write.
func topicOf(list *models.List) (string, bool) {
	if list.TopicId == nil {
		return "", false
	}
	topicId := strings.TrimSpace(*list.TopicId)
	return topicId, topicId != ""
}

// assigneeNames resolves a job's assignees to the display names their project
// membership carries. An assignee with no matching member is dropped rather
// than printed as an id — the same reason ProjectMember denormalizes the name
// in the first place.
func assigneeNames(project *models.Project, job *models.Job) []string {
	if len(job.Assignees) == 0 {
		return nil
	}

	byRefId := make(map[string]string, len(project.Members))
	for i := range project.Members {
		byRefId[project.Members[i].RefId] = strings.TrimSpace(project.Members[i].DisplayName)
	}

	names := make([]string, 0, len(job.Assignees))
	for i := range job.Assignees {
		if name := byRefId[job.Assignees[i].RefId]; name != "" {
			names = append(names, name)
		}
	}
	return names
}

// post sends one announcement into the project's group, addressing topicId
// ("" = the General topic).
func post(project *models.Project, topicId, text string) {
	if project.ChatId == nil || strings.TrimSpace(*project.ChatId) == "" {
		facades.Log().Warning("workdesk: project «" + project.Name + "» has no group to announce in")
		return
	}

	if err := botapi.New().SendGroupMessage(strings.TrimSpace(*project.ChatId), topicId, text); err != nil {
		facades.Log().Error("workdesk: announcing in project «" + project.Name + "»'s group failed: " + err.Error())
	}
}
