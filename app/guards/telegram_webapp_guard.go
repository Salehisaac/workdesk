// Package guards holds custom Goravel auth guards. TelegramWebAppGuard is
// registered via facades.Auth().Extend in app/providers/auth_service_provider.go.
package guards

import (
	"errors"
	"strconv"
	"strings"
	"time"

	contractsauth "github.com/goravel/framework/contracts/auth"
	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
	"goravel/app/models"
	"goravel/app/support/telegramauth"
)

// initDataMaxAge bounds how old a launch's initData can be and still be
// accepted — see plan section 5.
const initDataMaxAge = 24 * time.Hour

var errNotSupported = errors.New(
	"guards: not supported by the telegram-webapp guard — every request is verified independently " +
		"from its own initData, there is no session to log into, out of, or refresh",
)

// TelegramWebAppGuard authenticates every request from its own
// Authorization: Bearer <initData> header (plan section 5) — no session, no
// login/logout, no gRPC call to teamgram-server. Verification happens once,
// eagerly, when the guard is constructed for the current request (see
// NewTelegramWebAppGuard); Check/Guest/ID/User just read the cached result.
type TelegramWebAppGuard struct {
	user *telegramauth.User
	err  error
}

var _ contractsauth.GuardFunc = NewTelegramWebAppGuard

// NewTelegramWebAppGuard is a contractsauth.GuardFunc.
func NewTelegramWebAppGuard(ctx http.Context, _ string, _ contractsauth.UserProvider) (contractsauth.GuardDriver, error) {
	guard := &TelegramWebAppGuard{}

	botToken := facades.Config().GetString("services.rasagram.bot_token")
	if botToken == "" {
		guard.err = errors.New("guards: services.rasagram.bot_token is not configured (set RASAGRAM_BOT_TOKEN)")
		return guard, nil
	}

	initData := extractBearerToken(ctx)
	if initData == "" {
		guard.err = errors.New("guards: missing Authorization: Bearer <initData> header")
		return guard, nil
	}

	user, err := telegramauth.Verify(initData, botToken, initDataMaxAge)
	if err != nil {
		// TEMPORARY — logs the raw initData on every verification failure so
		// a real launch's signature mismatch can be diagnosed against real
		// data instead of guessed at. Remove once the real bot-token/key
		// format is confirmed (see plan section 5's open risk on this).
		facades.Log().Warning("workdesk: initData verification failed: " + err.Error() + " | raw initData: " + initData)
		guard.err = err
		return guard, nil
	}

	guard.user = user
	return guard, nil
}

func extractBearerToken(ctx http.Context) string {
	const prefix = "Bearer "
	header := ctx.Request().Header("Authorization")
	if !strings.HasPrefix(header, prefix) {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(header, prefix))
}

func (g *TelegramWebAppGuard) Check() bool {
	return g.err == nil && g.user != nil
}

func (g *TelegramWebAppGuard) Guest() bool {
	return !g.Check()
}

func (g *TelegramWebAppGuard) ID() (string, error) {
	if g.err != nil {
		return "", g.err
	}
	return strconv.FormatInt(g.user.ID, 10), nil
}

// User populates user, which must be a *models.AuthUser.
func (g *TelegramWebAppGuard) User(user any) error {
	if g.err != nil {
		return g.err
	}

	authUser, ok := user.(*models.AuthUser)
	if !ok {
		return errors.New("guards: telegram-webapp guard's User(user any) expects a *models.AuthUser")
	}

	authUser.ID = strconv.FormatInt(g.user.ID, 10)
	authUser.FirstName = g.user.FirstName
	authUser.LastName = g.user.LastName
	authUser.Username = g.user.Username
	authUser.LanguageCode = g.user.LanguageCode
	return nil
}

func (g *TelegramWebAppGuard) Login(_ any) (string, error) {
	return "", errNotSupported
}

func (g *TelegramWebAppGuard) LoginUsingID(_ any) (string, error) {
	return "", errNotSupported
}

func (g *TelegramWebAppGuard) Logout() error {
	return errNotSupported
}

func (g *TelegramWebAppGuard) Parse(_ string) (*contractsauth.Payload, error) {
	return nil, errNotSupported
}

func (g *TelegramWebAppGuard) Refresh() (string, error) {
	return "", errNotSupported
}
