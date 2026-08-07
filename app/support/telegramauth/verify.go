// Package telegramauth verifies the Authorization: Bearer <initData> header
// every WorkDesk API request carries (plan section 5). This is the verifying
// half of the signing algorithm in
// teamgram.io/bots/app/bff/minibotapps/internal/core/messages.requestWebView_handler.go
// (computeHash/generateDataCheckString) — same nested HMAC-SHA256, just
// checked instead of produced. No network call: this only needs WorkDesk's
// own copy of the bot token, which is exactly what makes it satisfy
// constraint #3 (no gRPC to teamgram-server).
package telegramauth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

var (
	ErrMissingHash      = errors.New("telegramauth: initData has no hash field")
	ErrInvalidSignature = errors.New("telegramauth: signature does not match")
	ErrStale            = errors.New("telegramauth: initData is too old")
	ErrInvalidAuthDate  = errors.New("telegramauth: auth_date is not a valid timestamp")
	ErrMissingUser      = errors.New("telegramauth: initData has no user field")
	ErrInvalidUser      = errors.New("telegramauth: user field is not valid JSON")
)

// User is the identity carried inside a verified initData payload. Mirrors
// Telegram's WebAppUser shape, only the fields WorkDesk actually uses.
type User struct {
	ID           int64  `json:"id"`
	FirstName    string `json:"first_name"`
	LastName     string `json:"last_name"`
	Username     string `json:"username"`
	LanguageCode string `json:"language_code"`
}

// Verify checks a Rasagram/Telegram Mini App initData string against botToken
// and returns the embedded user if the signature is valid. maxAge rejects an
// otherwise-valid signature if auth_date is older than it; pass 0 to disable
// the freshness check.
func Verify(initData, botToken string, maxAge time.Duration) (*User, error) {
	values, err := url.ParseQuery(initData)
	if err != nil {
		return nil, err
	}

	providedHash := values.Get("hash")
	if providedHash == "" {
		return nil, ErrMissingHash
	}
	values.Del("hash")

	expectedHash := computeHash(botToken, buildDataCheckString(values))
	if !hmac.Equal([]byte(expectedHash), []byte(providedHash)) {
		return nil, ErrInvalidSignature
	}

	if maxAge > 0 {
		authDateUnix, err := strconv.ParseInt(values.Get("auth_date"), 10, 64)
		if err != nil {
			return nil, ErrInvalidAuthDate
		}
		if time.Since(time.Unix(authDateUnix, 0)) > maxAge {
			return nil, ErrStale
		}
	}

	userJSON := values.Get("user")
	if userJSON == "" {
		return nil, ErrMissingUser
	}

	var user User
	if err := json.Unmarshal([]byte(userJSON), &user); err != nil {
		return nil, ErrInvalidUser
	}

	return &user, nil
}

// computeHash mirrors computeHash() in messages.requestWebView_handler.go exactly.
func computeHash(botToken, dataCheckString string) string {
	secretKeyMAC := hmac.New(sha256.New, []byte("WebAppData"))
	secretKeyMAC.Write([]byte(botToken))
	secretKey := secretKeyMAC.Sum(nil)

	mac := hmac.New(sha256.New, secretKey)
	mac.Write([]byte(dataCheckString))
	return hex.EncodeToString(mac.Sum(nil))
}

// buildDataCheckString mirrors generateDataCheckString() in
// messages.requestWebView_handler.go exactly (minus the already-removed hash
// key). url.ParseQuery already decoded every value, matching what the real
// signing code hashes (plain values, encoded only for the final redirect URL).
func buildDataCheckString(values url.Values) string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, key+"="+values.Get(key))
	}
	return strings.Join(parts, "\n")
}
