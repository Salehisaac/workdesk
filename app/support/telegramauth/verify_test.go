package telegramauth

import (
	"net/url"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

const testBotToken = "123456:test-bot-token"

// sign builds a valid, signed initData string the same way
// messages.requestWebView_handler.go does, for testing against Verify.
func sign(botToken string, params map[string]string) string {
	values := url.Values{}
	for k, v := range params {
		values.Set(k, v)
	}
	hash := computeHash(botToken, buildDataCheckString(values))
	values.Set("hash", hash)
	return values.Encode()
}

func validParams() map[string]string {
	return map[string]string{
		"query_id":  "AAF45E1LAAAAAHjkTUtKkRwV",
		"auth_date": strconv.FormatInt(time.Now().Unix(), 10),
		"user":      `{"id":123456789,"first_name":"Ali","last_name":"Rezaei","username":"ali","language_code":"fa"}`,
	}
}

func TestVerify_ValidSignatureAccepted(t *testing.T) {
	initData := sign(testBotToken, validParams())

	user, err := Verify(initData, testBotToken, time.Hour)

	assert.NoError(t, err)
	assert.Equal(t, int64(123456789), user.ID)
	assert.Equal(t, "Ali", user.FirstName)
	assert.Equal(t, "Rezaei", user.LastName)
	assert.Equal(t, "ali", user.Username)
	assert.Equal(t, "fa", user.LanguageCode)
}

func TestVerify_WrongBotTokenRejected(t *testing.T) {
	initData := sign(testBotToken, validParams())

	_, err := Verify(initData, "a-different-bot-token", time.Hour)

	assert.ErrorIs(t, err, ErrInvalidSignature)
}

func TestVerify_TamperedFieldRejected(t *testing.T) {
	initData := sign(testBotToken, validParams())
	values, _ := url.ParseQuery(initData)
	// Attacker edits the user field after the fact — hash no longer matches.
	values.Set("user", `{"id":999999999,"first_name":"Attacker"}`)

	_, err := Verify(values.Encode(), testBotToken, time.Hour)

	assert.ErrorIs(t, err, ErrInvalidSignature)
}

func TestVerify_MissingHashRejected(t *testing.T) {
	params := validParams()
	values := url.Values{}
	for k, v := range params {
		values.Set(k, v)
	}

	_, err := Verify(values.Encode(), testBotToken, time.Hour)

	assert.ErrorIs(t, err, ErrMissingHash)
}

func TestVerify_StaleRejected(t *testing.T) {
	params := validParams()
	params["auth_date"] = strconv.FormatInt(time.Now().Add(-48*time.Hour).Unix(), 10)
	initData := sign(testBotToken, params)

	_, err := Verify(initData, testBotToken, 24*time.Hour)

	assert.ErrorIs(t, err, ErrStale)
}

func TestVerify_StaleCheckDisabledWhenMaxAgeZero(t *testing.T) {
	params := validParams()
	params["auth_date"] = strconv.FormatInt(time.Now().Add(-48*time.Hour).Unix(), 10)
	initData := sign(testBotToken, params)

	_, err := Verify(initData, testBotToken, 0)

	assert.NoError(t, err)
}

func TestVerify_MissingUserRejected(t *testing.T) {
	params := map[string]string{"auth_date": strconv.FormatInt(time.Now().Unix(), 10)}
	initData := sign(testBotToken, params)

	_, err := Verify(initData, testBotToken, time.Hour)

	assert.ErrorIs(t, err, ErrMissingUser)
}

func TestVerify_InvalidUserJSONRejected(t *testing.T) {
	params := validParams()
	params["user"] = "not-json"
	initData := sign(testBotToken, params)

	_, err := Verify(initData, testBotToken, time.Hour)

	assert.ErrorIs(t, err, ErrInvalidUser)
}
