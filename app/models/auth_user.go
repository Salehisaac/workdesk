package models

// AuthUser is the identity WorkDesk trusts for the current request, parsed
// from a verified Rasagram/Telegram initData payload (plan section 5).
// Deliberately NOT an ORM model / database table — WorkDesk never syncs or
// stores user data (plan constraint #3: no gRPC to teamgram-server). Any
// place that needs to remember a person (project members, assignees) stores
// this same opaque shape directly, not a foreign key into a users table.
type AuthUser struct {
	ID           string
	FirstName    string
	LastName     string
	Username     string
	LanguageCode string
}
