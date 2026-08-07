package controllers

import (
	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
	"goravel/app/models"
)

// MeController exists to verify the auth guard end-to-end —
// GET /api/v1/me returns whatever identity the guard extracted from
// initData. Not part of the real API contract (see API_CONTRACT.md), just a
// diagnostic endpoint for confirming the guard works before building the
// real Project endpoints on top of it.
type MeController struct{}

func NewMeController() *MeController {
	return &MeController{}
}

func (r *MeController) Show(ctx http.Context) http.Response {
	var user models.AuthUser
	if err := facades.Auth(ctx).User(&user); err != nil {
		return ctx.Response().Status(401).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"id":           user.ID,
		"firstName":    user.FirstName,
		"lastName":     user.LastName,
		"username":     user.Username,
		"languageCode": user.LanguageCode,
	})
}
