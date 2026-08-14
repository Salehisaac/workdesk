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
	"mime/multipart"
	"net/http"
	"strconv"
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

// Photo is a group avatar uploaded with the chat itself — raw image bytes
// (jpeg, png or gif) plus the filename to send them under.
type Photo struct {
	Filename string
	Content  []byte
}

// CreateTopicGroup provisions a dedicated forum-enabled supergroup for a new
// Project: create a normal group chat, upgrade it to a supergroup, enable
// topics on it. Returns the resulting channel id — stored as Project.ChatId.
// All-or-nothing: if any step fails, the caller shouldn't persist a Project
// pointing at a half-provisioned or nonexistent group.
//
// userIDs is ORDERED: chat/create makes the first id the group's owner, so
// callers put the person the group belongs to at the front (see
// ProjectController.Store — everyone else, the bot included, follows).
//
// photo is optional; when non-nil the group is created with that avatar
// already set, which is why the caller no longer needs the bot to be an
// administrator with can_change_info just to give a project a picture.
func (c *Client) CreateTopicGroup(title string, userIDs []int64, photo *Photo) (int64, error) {
	chatID, err := c.createChat(title, userIDs, photo)
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

// DeleteChannel deletes a whole supergroup — the mirror of CreateTopicGroup,
// used when a project is deleted and its group has nothing left to be about.
//
// channelID is Project.ChatId (the channel id CreateTopicGroup returned), passed
// raw and positive: this is the admin API, which speaks the platform's own ids,
// not the Bot API's negated convention.
//
// The delete is invoked as the channel's CREATOR server-side (the panel resolves
// the actor itself and the platform rejects anyone else with
// ErrChatAdminRequired), which is the other reason ProjectController.Store puts
// the person creating the project first in user_ids — the group belongs to them,
// so a delete on their behalf is one the platform will accept. It fans out from
// there: the channel row goes, and every member loses the dialog. There is no
// undelete.
func (c *Client) DeleteChannel(channelID int64) error {
	var result envelope[json.RawMessage]
	if err := c.post("/x/internal/channel/delete", map[string]any{
		"channel_id": channelID,
	}, &result); err != nil {
		return fmt.Errorf("rasagramadmin: delete channel: %w", err)
	}
	if !result.Ok {
		return fmt.Errorf("rasagramadmin: delete channel: response ok=false")
	}
	return nil
}

type createChatResult struct {
	ChatID int64 `json:"chat_id"`
}

// createChat creates the group. Without a photo it's the plain JSON call;
// with one, the same endpoint also accepts multipart/form-data — title, the
// user_ids field repeated once per id, and the image under "file".
func (c *Client) createChat(title string, userIDs []int64, photo *Photo) (int64, error) {
	var result envelope[createChatResult]
	var err error
	if photo == nil {
		err = c.post("/x/internal/chat/create", map[string]any{
			"title":    title,
			"user_ids": userIDs,
		}, &result)
	} else {
		var contentType string
		var body []byte
		contentType, body, err = createChatForm(title, userIDs, photo)
		if err != nil {
			return 0, err
		}
		err = c.postRaw("/x/internal/chat/create", contentType, body, &result)
	}
	if err != nil {
		return 0, err
	}
	if !result.Ok {
		return 0, fmt.Errorf("response ok=false")
	}
	return result.Result.ChatID, nil
}

func createChatForm(title string, userIDs []int64, photo *Photo) (string, []byte, error) {
	var body bytes.Buffer
	form := multipart.NewWriter(&body)

	if err := form.WriteField("title", title); err != nil {
		return "", nil, err
	}
	for _, id := range userIDs {
		if err := form.WriteField("user_ids", strconv.FormatInt(id, 10)); err != nil {
			return "", nil, err
		}
	}
	part, err := form.CreateFormFile("file", photo.Filename)
	if err != nil {
		return "", nil, err
	}
	if _, err := part.Write(photo.Content); err != nil {
		return "", nil, err
	}
	if err := form.Close(); err != nil {
		return "", nil, err
	}

	return form.FormDataContentType(), body.Bytes(), nil
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

// Confirmed against a real response: this is a Casdoor-backed login, so
// result is Casdoor's own OAuth token shape (access_token/id_token/
// refresh_token/token_type/expires_in/scope) rather than a bespoke
// {"token":"..."} — access_token is the bearer token the other endpoints
// expect.
type loginResult struct {
	AccessToken string `json:"access_token"`
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
	if !parsed.Ok || parsed.Result.AccessToken == "" {
		return "", fmt.Errorf("login response missing access_token (body: %s)", string(respBody))
	}
	return parsed.Result.AccessToken, nil
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
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return c.postRaw(path, "application/json", body, out)
}

// postRaw is the transport every call goes through — JSON callers via post(),
// and the multipart one (createChat with a photo) directly. Both share the
// same bearer token, the same re-login-once-on-401, and the same envelope
// handling.
func (c *Client) postRaw(path, contentType string, body []byte, out any) error {
	token, err := c.getToken()
	if err != nil {
		return fmt.Errorf("auth: %w", err)
	}

	status, respBody, err := c.doPost(path, contentType, body, token)
	if err != nil {
		return err
	}

	if status == http.StatusUnauthorized {
		c.invalidateToken()
		token, err = c.getToken()
		if err != nil {
			return fmt.Errorf("auth (retry): %w", err)
		}
		status, respBody, err = c.doPost(path, contentType, body, token)
		if err != nil {
			return err
		}
	}

	if status != http.StatusOK {
		return fmt.Errorf("%s: %d %s", path, status, string(respBody))
	}

	if out != nil {
		if err := json.Unmarshal(respBody, out); err != nil {
			return fmt.Errorf("%s: could not parse response: %w (body: %s)", path, err, string(respBody))
		}
	}
	return nil
}

func (c *Client) doPost(path, contentType string, body []byte, token string) (int, []byte, error) {
	req, err := http.NewRequest(http.MethodPost, c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", contentType)
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
