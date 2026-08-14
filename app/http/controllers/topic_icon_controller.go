package controllers

import (
	"bytes"
	"compress/gzip"
	"io"
	"strings"
	"time"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
	"goravel/app/services/botapi"
)

// animationCacheTtl is how long a decompressed icon is kept in memory.
//
// Long, because the thing being cached cannot change: a Bot API file_id names
// one immutable file, which is the same reason the response carries
// `immutable` to the browser. This is the server-side half of that — the
// browser's copy only helps the device that already fetched it, while this
// helps the first request from every other one.
const animationCacheTtl = 7 * 24 * time.Hour

func animationCacheKey(fileId string) string {
	return "topic-icon-animation:" + fileId
}

// TopicIconController exposes the Bot API's forum-topic icon stickers to
// the frontend — proxied through our own backend since the bot token can
// never reach the client. See CreateListSheet.tsx.
type TopicIconController struct{}

func NewTopicIconController() *TopicIconController {
	return &TopicIconController{}
}

// Index — GET /api/v1/topic-icons.
func (r *TopicIconController) Index(ctx http.Context) http.Response {
	if _, errResp := currentUser(ctx); errResp != nil {
		return errResp
	}

	stickers, err := botapi.New().GetForumTopicIconStickers()
	if err != nil {
		return ctx.Response().Status(502).Json(http.Json{"error": "could not load topic icons: " + err.Error()})
	}

	result := make([]http.Json, len(stickers))
	for i, sticker := range stickers {
		result[i] = http.Json{
			"customEmojiId": sticker.CustomEmojiId,
			"emoji":         sticker.Emoji,
			"fileId":        sticker.FileId,
		}
	}
	return ctx.Response().Success().Json(result)
}

// Animation — GET /api/v1/topic-icons/animation?fileId=... . Resolves and
// downloads the sticker (gzip-compressed Lottie JSON — confirmed against a
// real one, same .tgs format as real Telegram), decompresses it server-side
// so the frontend can feed the result straight into a Lottie player without
// needing a gunzip step of its own, and returns it with a long, immutable
// cache lifetime — these files never change under a given file_id.
func (r *TopicIconController) Animation(ctx http.Context) http.Response {
	if _, errResp := currentUser(ctx); errResp != nil {
		return errResp
	}

	fileId := ctx.Request().Query("fileId", "")
	if strings.TrimSpace(fileId) == "" {
		return ctx.Response().Status(422).Json(http.Json{"error": "fileId is required"})
	}

	// Two upstream round trips (getFile, then the download) per icon is a lot to
	// spend on a file that is defined to never change, and they used to be spent
	// again on every request — see the cache TTL above.
	if cached, ok := facades.Cache().Get(animationCacheKey(fileId)).([]byte); ok && len(cached) > 0 {
		ctx.Response().Header("Cache-Control", "public, max-age=604800, immutable")
		return ctx.Response().Data(200, "application/json", cached)
	}

	client := botapi.New()
	filePath, err := client.GetFile(fileId)
	if err != nil {
		return ctx.Response().Status(502).Json(http.Json{"error": "could not resolve icon file: " + err.Error()})
	}

	raw, err := client.DownloadFile(filePath)
	if err != nil {
		return ctx.Response().Status(502).Json(http.Json{"error": "could not download icon file: " + err.Error()})
	}

	gz, err := gzip.NewReader(bytes.NewReader(raw))
	if err != nil {
		return ctx.Response().Status(502).Json(http.Json{"error": "icon file is not gzip: " + err.Error()})
	}
	defer gz.Close()

	lottieJson, err := io.ReadAll(gz)
	if err != nil {
		return ctx.Response().Status(502).Json(http.Json{"error": "could not decompress icon file: " + err.Error()})
	}

	// Best-effort: a cache that refuses the write costs the next request a
	// re-fetch, which is exactly what used to happen every time anyway.
	if err := facades.Cache().Put(animationCacheKey(fileId), lottieJson, animationCacheTtl); err != nil {
		facades.Log().Warning("workdesk: caching topic icon " + fileId + " failed: " + err.Error())
	}

	ctx.Response().Header("Cache-Control", "public, max-age=604800, immutable")
	return ctx.Response().Data(200, "application/json", lottieJson)
}
