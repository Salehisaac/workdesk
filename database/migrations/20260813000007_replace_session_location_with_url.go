package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260813000007ReplaceSessionLocationWithUrl struct{}

// Signature The unique signature for the migration.
func (r *M20260813000007ReplaceSessionLocationWithUrl) Signature() string {
	return "20260813000007_replace_session_location_with_url"
}

// Up Run the migrations.
//
// Swaps the one field a session had for saying *where*: `location` goes, `url`
// arrives. The two are not the same field renamed — they belong to opposite
// halves of the `is_online` switch.
//
// A حضوری meeting's room was a free-text line nobody could act on: it went out
// in the invite as prose and came back as prose, and the people who needed it
// already knew the building. An online meeting's link is the opposite — it is
// the meeting, and typing it into an invite by hand was the one thing the module
// left people to do themselves.
//
// This drops the location column, and with it any room names already stored.
// Nothing else reads them, and a session's members were told the room in the
// invite message that went out at creation.
func (r *M20260813000007ReplaceSessionLocationWithUrl) Up() error {
	if !facades.Schema().HasTable("sessions") {
		return nil
	}

	if !facades.Schema().HasColumn("sessions", "url") {
		if err := facades.Schema().Table("sessions", func(table schema.Blueprint) {
			// Long: a conferencing link with its room id, passcode and tracking
			// query is routinely past what a default varchar would hold.
			table.Text("url").Nullable()
		}); err != nil {
			return err
		}
	}

	if !facades.Schema().HasColumn("sessions", "location") {
		return nil
	}

	return facades.Schema().Table("sessions", func(table schema.Blueprint) {
		table.DropColumn("location")
	})
}

// Down Reverse the migrations.
//
// Restores the column, not its contents — the room names are gone.
func (r *M20260813000007ReplaceSessionLocationWithUrl) Down() error {
	if !facades.Schema().HasTable("sessions") {
		return nil
	}

	if !facades.Schema().HasColumn("sessions", "location") {
		if err := facades.Schema().Table("sessions", func(table schema.Blueprint) {
			table.String("location").Nullable()
		}); err != nil {
			return err
		}
	}

	if !facades.Schema().HasColumn("sessions", "url") {
		return nil
	}

	return facades.Schema().Table("sessions", func(table schema.Blueprint) {
		table.DropColumn("url")
	})
}
