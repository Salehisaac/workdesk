package tests

import (
	"fmt"
	"os"
	"regexp"
	"strings"
	"testing"

	"goravel/bootstrap"
)

var migrationTypePattern = regexp.MustCompile(`(?m)^type\s+(M\w+)\s+struct`)

// Goravel doesn't discover migrations from the filesystem — each one has to be
// listed in bootstrap.Migrations() by hand. Writing the file and forgetting the
// list produces no error at all: `artisan migrate` reports success, the column
// never appears, and the first insert fails at runtime with
// `column "..." does not exist`. That happened once with confirmed_at on
// reminders; this keeps it from happening quietly again.
func TestEveryMigrationFileIsRegistered(t *testing.T) {
	entries, err := os.ReadDir("../database/migrations")
	if err != nil {
		t.Fatalf("could not read the migrations directory: %v", err)
	}

	onDisk := map[string]string{} // type name -> file name
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".go") || strings.HasSuffix(entry.Name(), "_test.go") {
			continue
		}
		source, err := os.ReadFile("../database/migrations/" + entry.Name())
		if err != nil {
			t.Fatalf("could not read %s: %v", entry.Name(), err)
		}
		for _, match := range migrationTypePattern.FindAllStringSubmatch(string(source), -1) {
			onDisk[match[1]] = entry.Name()
		}
	}
	if len(onDisk) == 0 {
		t.Fatal("found no migration types on disk — the pattern or the path is wrong")
	}

	registered := map[string]bool{}
	for _, migration := range bootstrap.Migrations() {
		// "*migrations.M20260812000005AddConfirmedAtToRemindersTable" -> the type name.
		name := fmt.Sprintf("%T", migration)
		registered[name[strings.LastIndex(name, ".")+1:]] = true
	}

	for typeName, file := range onDisk {
		if !registered[typeName] {
			t.Errorf("%s (%s) is not listed in bootstrap.Migrations() — it will never run", typeName, file)
		}
	}
}
