// Package botapi wraps Rasagram's Bot API (teamgram.io/bots' botway
// service) — a genuine implementation of Telegram's own Bot API, confirmed
// by reading botway's route/request/response definitions directly
// (app/interface/botway/botapi/botapi_available_methods.tl.go and
// internal/server/http/routes.go in the sibling teamgram.io/bots repo):
// requests are POSTed to /bot<token>/<method> (the "bot" prefix is literal,
// checked server-side), and responses use Telegram's standard envelope
// {"ok": bool, "result": ..., "error_code": ..., "description": ...}.
//
// This is only used for the per-List forum topic lifecycle (plan section
// 8) — group/channel creation itself goes through
// goravel/app/services/rasagramadmin instead, since the Bot API has never
// supported bots originating chats (real Telegram doesn't either).
package botapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"goravel/app/facades"
)

type Client struct {
	baseURL    string
	botToken   string
	httpClient *http.Client
}

func New() *Client {
	return &Client{
		baseURL:    facades.Config().GetString("services.rasagram.bot_api_base_url"),
		botToken:   facades.Config().GetString("services.rasagram.bot_token"),
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

type response struct {
	Ok          bool            `json:"ok"`
	Result      json.RawMessage `json:"result,omitempty"`
	ErrorCode   int             `json:"error_code,omitempty"`
	Description string          `json:"description,omitempty"`
}

// groupChatId converts a raw channel/chat id (as stored in Project.ChatId —
// the positive id rasagramadmin's own API uses) into this Bot API's chat_id
// convention. Confirmed by reading botway's MakePeer/ToChatIdType directly
// (teamgram.io/bots' app/interface/botway/internal/core/codec_botapi_util.go
// + botapi/core_botapi.go): unlike real Telegram's "-100<id>" scheme, a
// positive number here means a private user chat, and any negative number
// means group/channel — plain negation, no digit-prefix encoding. Passing
// the raw positive id through unchanged gets it misread as a user id (this
// is exactly what produced a real PEER_ID_INVALID against a live chat).
func groupChatId(chatId string) (string, error) {
	id, err := strconv.ParseInt(chatId, 10, 64)
	if err != nil {
		return "", fmt.Errorf("chat id %q is not numeric: %w", chatId, err)
	}
	if id > 0 {
		id = -id
	}
	return strconv.FormatInt(id, 10), nil
}

// ForumTopicColors are Telegram's 6 standard forum-topic icon colors (the
// exact preset dots real Telegram clients offer when creating a topic —
// the protocol itself accepts arbitrary RGB ints, but these are the only
// values any client actually presents, so it's what WorkDesk's picker
// offers too). 0/omitted means the platform's default icon.
var ForumTopicColors = []int64{
	0x6FB9F0, // آبی (blue)
	0xFFD67E, // زرد (yellow)
	0xCB86DB, // بنفش (purple)
	0x8EEE98, // سبز (green)
	0xFF93B2, // صورتی (pink)
	0xFB6F5F, // قرمز (red)
}

// TopicIconSticker is the subset of Telegram's Sticker object that matters
// for a topic-icon picker: CustomEmojiId is what gets sent back to
// createForumTopic, Emoji is the plain unicode character associated with it
// — good enough to render the picker/list-item icon without fetching or
// proxying the actual sticker image file.
type TopicIconSticker struct {
	CustomEmojiId string `json:"custom_emoji_id"`
	Emoji         string `json:"emoji"`
}

// GetForumTopicIconStickers fetches the platform's allowed set of
// custom-emoji topic icons — mirrors real Telegram's Bot API method of the
// same name exactly (no params, returns Sticker[]). NOTE: as of this
// writing, botway has no route for this method, and its getStickerSet route
// (which real Telegram's Bot API implements getForumTopicIconStickers on
// top of) is a stub that returns "not impl" — this call will fail until
// that's implemented on the platform side.
func (c *Client) GetForumTopicIconStickers() ([]TopicIconSticker, error) {
	var result []TopicIconSticker
	if err := c.post("getForumTopicIconStickers", map[string]any{}, &result); err != nil {
		return nil, fmt.Errorf("botapi: getForumTopicIconStickers: %w", err)
	}
	return result, nil
}

// CreateForumTopic creates a topic in chatId's forum (chatId must already be
// a forum-enabled supergroup — see rasagramadmin.CreateTopicGroup) and
// returns the new topic's message_thread_id, stored as List.TopicId.
// iconColor is optional (0 = the platform's default). iconCustomEmojiId is
// optional too — one of GetForumTopicIconStickers' returned ids, or "" for
// none.
func (c *Client) CreateForumTopic(chatId, name string, iconColor int64, iconCustomEmojiId string) (string, error) {
	groupId, err := groupChatId(chatId)
	if err != nil {
		return "", fmt.Errorf("botapi: createForumTopic: %w", err)
	}

	payload := map[string]any{
		"chat_id": groupId,
		"name":    name,
	}
	if iconColor != 0 {
		payload["icon_color"] = iconColor
	}
	if iconCustomEmojiId != "" {
		payload["icon_custom_emoji_id"] = iconCustomEmojiId
	}

	var result struct {
		MessageThreadId int64 `json:"message_thread_id"`
	}
	if err := c.post("createForumTopic", payload, &result); err != nil {
		return "", fmt.Errorf("botapi: createForumTopic: %w", err)
	}
	return fmt.Sprintf("%d", result.MessageThreadId), nil
}

// DeleteForumTopic deletes a previously created topic. The bot must be an
// admin in chatId with can_delete_messages rights.
func (c *Client) DeleteForumTopic(chatId, topicId string) error {
	groupId, err := groupChatId(chatId)
	if err != nil {
		return fmt.Errorf("botapi: deleteForumTopic: %w", err)
	}

	if err := c.post("deleteForumTopic", map[string]any{
		"chat_id":           groupId,
		"message_thread_id": topicId,
	}, nil); err != nil {
		return fmt.Errorf("botapi: deleteForumTopic: %w", err)
	}
	return nil
}

func (c *Client) post(method string, payload any, out any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/bot%s/%s", c.baseURL, c.botToken, method)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	respBody, err := io.ReadAll(res.Body)
	if err != nil {
		return err
	}

	var parsed response
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return fmt.Errorf("could not parse response: %w (body: %s)", err, string(respBody))
	}
	if !parsed.Ok {
		return fmt.Errorf("%d %s", parsed.ErrorCode, parsed.Description)
	}
	if out != nil && len(parsed.Result) > 0 {
		if err := json.Unmarshal(parsed.Result, out); err != nil {
			return fmt.Errorf("could not parse result: %w (body: %s)", err, string(respBody))
		}
	}
	return nil
}
