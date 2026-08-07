package seeders

// DatabaseSeeder is the root seeder run by `go run . artisan db:seed`
// (registered in bootstrap/database.go). Add new seeders to Run() as
// modules beyond Project get their own sample data.
type DatabaseSeeder struct{}

func (s *DatabaseSeeder) Signature() string {
	return "DatabaseSeeder"
}

func (s *DatabaseSeeder) Run() error {
	return (&ProjectSeeder{}).Run()
}
