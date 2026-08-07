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

// CreateForumTopic creates a topic in chatId's forum (chatId must already be
// a forum-enabled supergroup — see rasagramadmin.CreateTopicGroup) and
// returns the new topic's message_thread_id, stored as List.TopicId.
func (c *Client) CreateForumTopic(chatId, name string) (string, error) {
	var result struct {
		MessageThreadId int64 `json:"message_thread_id"`
	}
	if err := c.post("createForumTopic", map[string]any{
		"chat_id": chatId,
		"name":    name,
	}, &result); err != nil {
		return "", fmt.Errorf("botapi: createForumTopic: %w", err)
	}
	return fmt.Sprintf("%d", result.MessageThreadId), nil
}

// DeleteForumTopic deletes a previously created topic. The bot must be an
// admin in chatId with can_delete_messages rights.
func (c *Client) DeleteForumTopic(chatId, topicId string) error {
	if err := c.post("deleteForumTopic", map[string]any{
		"chat_id":           chatId,
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
