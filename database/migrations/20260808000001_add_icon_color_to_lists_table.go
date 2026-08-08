package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260808000001AddIconColorToListsTable struct{}

// Signature The unique signature for the migration.
func (r *M20260808000001AddIconColorToListsTable) Signature() string {
	return "20260808000001_add_icon_color_to_lists_table"
}

// Up Run the migrations.
func (r *M20260808000001AddIconColorToListsTable) Up() error {
	if !facades.Schema().HasColumn("lists", "icon_color") {
		return facades.Schema().Table("lists", func(table schema.Blueprint) {
			// The forum topic's icon_color (Bot API createForumTopic) — one
			// of Telegram's 6 standard preset RGB ints, or null for the
			// platform's default icon. Passed straight through, never
			// interpreted here.
			table.UnsignedBigInteger("icon_color").Nullable()
		})
	}
	return nil
}

// Down Reverse the migrations.
func (r *M20260808000001AddIconColorToListsTable) Down() error {
	return facades.Schema().Table("lists", func(table schema.Blueprint) {
		table.DropColumn("icon_color")
	})
}
