package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260808000002AddIconEmojiToListsTable struct{}

// Signature The unique signature for the migration.
func (r *M20260808000002AddIconEmojiToListsTable) Signature() string {
	return "20260808000002_add_icon_emoji_to_lists_table"
}

// Up Run the migrations.
func (r *M20260808000002AddIconEmojiToListsTable) Up() error {
	return facades.Schema().Table("lists", func(table schema.Blueprint) {
		if !facades.Schema().HasColumn("lists", "icon_custom_emoji_id") {
			// Sent to the Bot API's createForumTopic as icon_custom_emoji_id —
			// opaque, sourced from GET /api/v1/topic-icons (app/services/botapi's
			// GetForumTopicIconStickers), never interpreted server-side.
			table.String("icon_custom_emoji_id").Nullable()
		}
		if !facades.Schema().HasColumn("lists", "icon_emoji") {
			// Denormalized display copy of the chosen sticker's associated
			// unicode emoji (same pattern as ProjectMember's denormalized
			// display fields) — lets the frontend show the icon without
			// re-fetching/matching against the topic-icons list every time.
			table.String("icon_emoji").Nullable()
		}
	})
}

// Down Reverse the migrations.
func (r *M20260808000002AddIconEmojiToListsTable) Down() error {
	return facades.Schema().Table("lists", func(table schema.Blueprint) {
		table.DropColumn("icon_custom_emoji_id")
		table.DropColumn("icon_emoji")
	})
}
