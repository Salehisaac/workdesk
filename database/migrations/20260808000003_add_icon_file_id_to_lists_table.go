package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260808000003AddIconFileIdToListsTable struct{}

// Signature The unique signature for the migration.
func (r *M20260808000003AddIconFileIdToListsTable) Signature() string {
	return "20260808000003_add_icon_file_id_to_lists_table"
}

// Up Run the migrations.
func (r *M20260808000003AddIconFileIdToListsTable) Up() error {
	if !facades.Schema().HasColumn("lists", "icon_file_id") {
		return facades.Schema().Table("lists", func(table schema.Blueprint) {
			// The chosen icon sticker's file_id — lets the frontend re-fetch
			// GET /topic-icons/animation directly without re-fetching and
			// searching GET /topic-icons by icon_custom_emoji_id every time.
			table.String("icon_file_id").Nullable()
		})
	}
	return nil
}

// Down Reverse the migrations.
func (r *M20260808000003AddIconFileIdToListsTable) Down() error {
	return facades.Schema().Table("lists", func(table schema.Blueprint) {
		table.DropColumn("icon_file_id")
	})
}
