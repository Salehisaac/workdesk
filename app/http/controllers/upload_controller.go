package controllers

import (
	"slices"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
)

type UploadController struct{}

func NewUploadController() *UploadController {
	return &UploadController{}
}

// allowedAvatarMimeTypes — this endpoint only exists for the create-wizard's
// avatar picker (StepNameAvatar.tsx), so images are all it should ever
// accept. Checked against content-sniffed bytes (file.MimeType(), backed by
// magic-byte detection), never the client-supplied filename/Content-Type —
// both are attacker-controlled and trivially spoofed.
var allowedAvatarMimeTypes = []string{"image/png", "image/jpeg", "image/gif", "image/webp"}

const maxAvatarUploadBytes = 5 << 20 // 5 MiB

// Store — POST /api/v1/uploads. multipart/form-data, field "file".
func (r *UploadController) Store(ctx http.Context) http.Response {
	file, err := ctx.Request().File("file")
	if err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "file is required"})
	}

	size, err := file.Size()
	if err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "could not read file"})
	}
	if size > maxAvatarUploadBytes {
		return ctx.Response().Status(422).Json(http.Json{"error": "file is too large (max 5MB)"})
	}

	// Without this check, any file type is accepted and stored with its
	// real (content-sniffed) extension — e.g. a genuine .html upload gets
	// stored and served as .html, from the same origin as the rest of the
	// app (plan section 7). Opening that URL directly executes whatever
	// script it contains: stored XSS. Images can't do that.
	mimeType, err := file.MimeType()
	if err != nil {
		return ctx.Response().Status(422).Json(http.Json{"error": "could not determine file type"})
	}
	if !slices.Contains(allowedAvatarMimeTypes, mimeType) {
		return ctx.Response().Status(422).Json(http.Json{"error": "only PNG, JPEG, GIF, or WebP images are allowed"})
	}

	disk := facades.Storage().Disk("public")
	path, err := disk.PutFile("uploads", file)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{"url": disk.Url(path)})
}
