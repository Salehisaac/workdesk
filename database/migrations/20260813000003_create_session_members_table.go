package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260813000003CreateSessionMembersTable struct{}

// Signature The unique signature for the migration.
func (r *M20260813000003CreateSessionMembersTable) Signature() string {
	return "20260813000003_create_session_members_table"
}

// Up Run the migrations.
//
// The same shape as project_members — a bridge pick() item stored verbatim —
// plus one column project members have no use for: notified_at.
//
// A project tells its members it exists by adding them to a group they can see.
// A session has no group, so the invite IS the notification: a direct message
// from the bot carrying a deep link to the session. notified_at records whether
// that message actually went out, so the UI can say "۲ نفر پیام را دریافت
// نکردند" instead of quietly implying everyone was told.
func (r *M20260813000003CreateSessionMembersTable) Up() error {
	if facades.Schema().HasTable("session_members") {
		return nil
	}

	return facades.Schema().Create("session_members", func(table schema.Blueprint) {
		table.ID()
		table.UnsignedBigInteger("session_id")
		table.String("ref_id")
		// users | contacts | groups | channels | bots | recentChats | favorites
		table.String("ref_source", 20)
		table.String("display_name")
		table.String("username").Nullable()
		table.String("phone").Nullable()
		table.Boolean("online").Default(false)
		// "owner" | "member" — same two roles project_members uses.
		table.String("role", 20).Default("member")
		// When the invite DM reached them. Null means it didn't (yet): the bot
		// can only open a chat with someone who has started it, so a member who
		// has never opened the bot legitimately stays null.
		table.DateTimeTz("notified_at").Nullable()
		table.TimestampsTz()

		table.Foreign("session_id").References("id").On("sessions").CascadeOnDelete()
		table.Index("session_id")
		// "which sessions is this person in" — the GET /sessions path.
		table.Index("ref_id")
	})
}

// Down Reverse the migrations.
func (r *M20260813000003CreateSessionMembersTable) Down() error {
	return facades.Schema().DropIfExists("session_members")
}
