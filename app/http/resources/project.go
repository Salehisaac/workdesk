// Package resources shapes ORM models into the exact camelCase JSON the
// frontend expects (API_CONTRACT.md) — kept separate from the models
// themselves so persistence shape and wire shape can drift independently.
package resources

import (
	"strconv"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/models"
)

func formatId(id uint) string {
	return strconv.FormatUint(uint64(id), 10)
}

// Project matches the `Project` shape in API_CONTRACT.md. Members must
// already be loaded (via .With("Members")) — memberCount/onlineCount are
// derived from it rather than a separate count query.
func Project(p *models.Project) http.Json {
	onlineCount := 0
	for _, member := range p.Members {
		if member.Online {
			onlineCount++
		}
	}

	var createdAt string
	if p.CreatedAt != nil {
		createdAt = p.CreatedAt.ToRfc3339String()
	}

	return http.Json{
		"id":          formatId(p.ID),
		"name":        p.Name,
		"avatarUrl":   p.AvatarUrl,
		"visibility":  p.Visibility,
		"joinSlug":    p.JoinSlug,
		"chatId":      p.ChatId,
		"memberCount": len(p.Members),
		"onlineCount": onlineCount,
		"createdAt":   createdAt,
	}
}

func Projects(projects []models.Project) []http.Json {
	result := make([]http.Json, len(projects))
	for i := range projects {
		result[i] = Project(&projects[i])
	}
	return result
}

// ProjectMember matches the `PickedItem`-shaped member entries in
// API_CONTRACT.md / plan section 4.
func ProjectMember(m *models.ProjectMember) http.Json {
	return http.Json{
		"id":          m.RefId,
		"source":      m.RefSource,
		"displayName": m.DisplayName,
		"username":    m.Username,
		"phone":       m.Phone,
		"online":      m.Online,
	}
}

func ProjectMembers(members []models.ProjectMember) []http.Json {
	result := make([]http.Json, len(members))
	for i := range members {
		result[i] = ProjectMember(&members[i])
	}
	return result
}

// List matches the `ProjectListItem` shape in API_CONTRACT.md.
func List(l *models.List) http.Json {
	return http.Json{
		"id":                formatId(l.ID),
		"projectId":         formatId(l.ProjectId),
		"name":              l.Name,
		"topicId":           l.TopicId,
		"iconColor":         l.IconColor,
		"iconCustomEmojiId": l.IconCustomEmojiId,
		"iconEmoji":         l.IconEmoji,
		"iconFileId":        l.IconFileId,
	}
}

func Lists(lists []models.List) []http.Json {
	result := make([]http.Json, len(lists))
	for i := range lists {
		result[i] = List(&lists[i])
	}
	return result
}

// ProjectDetail matches the `ProjectDetail` shape (Project + members + lists).
func ProjectDetail(p *models.Project) http.Json {
	json := Project(p)
	json["members"] = ProjectMembers(p.Members)
	json["lists"] = Lists(p.Lists)
	return json
}
