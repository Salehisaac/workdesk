// Package rasagramadmin wraps Rasagram's internal admin API
// (https://rasagram-new-admin.rso-co.ir/x/internal/...) — the only surface
// that can actually create a group on the platform's behalf. Neither the
// mini-app bridge (no createGroup method — confirmed by reading the deployed
// SDK source) nor the public Bot API (no createChat/createGroup route —
// confirmed by grepping teamgram.io/bots' full route list) can do this; this
// internal API is what plan section 8's "Open Risks" #1 turned out to be.
//
// Server-to-server only. Never exposed to the frontend, and the frontend no
// longer needs to create anything client-side before calling POST /projects
// — WorkDesk's own backend provisions the topic-group now.
package rasagramadmin

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"goravel/app/facades"
)

type Client struct {
	baseURL  string
	username string
	password string

	httpClient *http.Client

	mu    sync.Mutex
	token string
}

func New() *Client {
	return &Client{
		baseURL:    facades.Config().GetString("services.rasagram_admin.base_url"),
		username:   facades.Config().GetString("services.rasagram_admin.username"),
		password:   facades.Config().GetString("services.rasagram_admin.password"),
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

type envelope[T any] struct {
	Ok     bool `json:"ok"`
	Result T    `json:"result"`
}

// CreateTopicGroup provisions a dedicated forum-enabled supergroup for a new
// Project: create a normal group chat, upgrade it to a supergroup, enable
// topics on it. Returns the resulting channel id — stored as Project.ChatId.
// All-or-nothing: if any step fails, the caller shouldn't persist a Project
// pointing at a half-provisioned or nonexistent group.
func (c *Client) CreateTopicGroup(title string, userIDs []int64) (int64, error) {
	chatID, err := c.createChat(title, userIDs)
	if err != nil {
		return 0, fmt.Errorf("rasagramadmin: create chat: %w", err)
	}

	channelID, err := c.upgradeToSupergroup(chatID)
	if err != nil {
		return 0, fmt.Errorf("rasagramadmin: upgrade to supergroup: %w", err)
	}

	if err := c.enableTopics(channelID); err != nil {
		return 0, fmt.Errorf("rasagramadmin: enable topics: %w", err)
	}

	return channelID, nil
}

type createChatResult struct {
	ChatID int64 `json:"chat_id"`
}

func (c *Client) createChat(title string, userIDs []int64) (int64, error) {
	var result envelope[createChatResult]
	err := c.post("/x/internal/chat/create", map[string]any{
		"title":    title,
		"user_ids": userIDs,
	}, &result)
	if err != nil {
		return 0, err
	}
	if !result.Ok {
		return 0, fmt.Errorf("response ok=false")
	}
	return result.Result.ChatID, nil
}

type upgradeResult struct {
	ChannelID int64 `json:"channel_id"`
}

func (c *Client) upgradeToSupergroup(chatID int64) (int64, error) {
	var result envelope[upgradeResult]
	err := c.post("/x/internal/chat/upgradeToSupergroup", map[string]any{
		"chat_id": chatID,
	}, &result)
	if err != nil {
		return 0, err
	}
	if !result.Ok {
		return 0, fmt.Errorf("response ok=false")
	}
	return result.Result.ChannelID, nil
}

func (c *Client) enableTopics(channelID int64) error {
	var result envelope[json.RawMessage]
	err := c.post("/x/internal/chat/enableTopics", map[string]any{
		"channel_id": channelID,
		"enabled":    true,
		"tabs":       false,
	}, &result)
	if err != nil {
		return err
	}
	if !result.Ok {
		return fmt.Errorf("response ok=false")
	}
	return nil
}

// login shape is assumed — the actual response body for
// /x/internal/auth/login wasn't confirmed, only the endpoint/credentials.
// If it doesn't return {"ok":true,"result":{"token":"..."}}, this is the one
// place to fix.
type loginResult struct {
	Token string `json:"token"`
}

func (c *Client) login() (string, error) {
	body, err := json.Marshal(map[string]string{
		"username": c.username,
		"password": c.password,
	})
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest(http.MethodPost, c.baseURL+"/x/internal/auth/login", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	respBody, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}
	if res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("login failed: %d %s", res.StatusCode, string(respBody))
	}

	var parsed envelope[loginResult]
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", fmt.Errorf("could not parse login response: %w (body: %s)", err, string(respBody))
	}
	if !parsed.Ok || parsed.Result.Token == "" {
		return "", fmt.Errorf("login response missing token (body: %s)", string(respBody))
	}
	return parsed.Result.Token, nil
}

// getToken returns a cached token, logging in only the first time it's
// needed. post() clears the cache and retries once on a 401, so an expired
// token self-heals on the next call without needing a TTL guess here.
func (c *Client) getToken() (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.token != "" {
		return c.token, nil
	}
	token, err := c.login()
	if err != nil {
		return "", err
	}
	c.token = token
	return token, nil
}

func (c *Client) invalidateToken() {
	c.mu.Lock()
	c.token = ""
	c.mu.Unlock()
}

func (c *Client) post(path string, payload any, out any) error {
	token, err := c.getToken()
	if err != nil {
		return fmt.Errorf("auth: %w", err)
	}

	status, body, err := c.doPost(path, payload, token)
	if err != nil {
		return err
	}

	if status == http.StatusUnauthorized {
		c.invalidateToken()
		token, err = c.getToken()
		if err != nil {
			return fmt.Errorf("auth (retry): %w", err)
		}
		status, body, err = c.doPost(path, payload, token)
		if err != nil {
			return err
		}
	}

	if status != http.StatusOK {
		return fmt.Errorf("%s: %d %s", path, status, string(body))
	}

	if out != nil {
		if err := json.Unmarshal(body, out); err != nil {
			return fmt.Errorf("%s: could not parse response: %w (body: %s)", path, err, string(body))
		}
	}
	return nil
}

func (c *Client) doPost(path string, payload any, token string) (int, []byte, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return 0, nil, err
	}

	req, err := http.NewRequest(http.MethodPost, c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	res, err := c.httpClient.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer res.Body.Close()

	respBody, err := io.ReadAll(res.Body)
	if err != nil {
		return 0, nil, err
	}
	return res.StatusCode, respBody, nil
}
