package controllers

import (
	"github.com/goravel/framework/contracts/http"

	"goravel/app/services/botapi"
)

// TopicIconController exposes the Bot API's forum-topic icon stickers to
// the frontend — proxied through our own backend since the bot token can
// never reach the client. See CreateListSheet.tsx.
type TopicIconController struct{}

func NewTopicIconController() *TopicIconController {
	return &TopicIconController{}
}

// Index — GET /api/v1/topic-icons.
func (r *TopicIconController) Index(ctx http.Context) http.Response {
	if _, errResp := currentUser(ctx); errResp != nil {
		return errResp
	}

	stickers, err := botapi.New().GetForumTopicIconStickers()
	if err != nil {
		return ctx.Response().Status(502).Json(http.Json{"error": "could not load topic icons: " + err.Error()})
	}

	result := make([]http.Json, len(stickers))
	for i, sticker := range stickers {
		result[i] = http.Json{
			"customEmojiId": sticker.CustomEmojiId,
			"emoji":         sticker.Emoji,
		}
	}
	return ctx.Response().Success().Json(result)
}
