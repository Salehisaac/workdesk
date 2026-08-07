package controllers

import (
	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
)

type UploadController struct{}

func NewUploadController() *UploadController {
	return &UploadController{}
}

// Store — POST /api/v1/uploads. multipart/form-data, field "file". Used by
// the create-wizard's avatar picker (StepNameAvatar.tsx).
func (r *UploadController) Store(ctx http.Context) http.Response {
	file, err := ctx.Request().File("file")
	if err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "file is required"})
	}

	disk := facades.Storage().Disk("public")
	path, err := disk.PutFile("uploads", file)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{"url": disk.Url(path)})
}
