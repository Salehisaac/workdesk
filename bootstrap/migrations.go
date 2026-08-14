package bootstrap

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/database/migrations"
)

func Migrations() []schema.Migration {
	return []schema.Migration{
		&migrations.M20210101000001CreateJobsTable{},
		&migrations.M20260807000001CreateProjectsTable{},
		&migrations.M20260807000002CreateProjectMembersTable{},
		&migrations.M20260807000003CreateListsTable{},
		&migrations.M20260808000001AddIconColorToListsTable{},
		&migrations.M20260808000002AddIconEmojiToListsTable{},
		&migrations.M20260808000003AddIconFileIdToListsTable{},
		&migrations.M20260812000001CreateProjectTagsTable{},
		&migrations.M20260812000002CreateProjectJobsTable{},
		&migrations.M20260812000003CreateJobRelationsTables{},
		&migrations.M20260812000004CreateRemindersTable{},
		&migrations.M20260812000005AddConfirmedAtToRemindersTable{},
		&migrations.M20260812000006DropConfirmedAtFromRemindersTable{},
		&migrations.M20260813000001CreateNotesTable{},
		&migrations.M20260813000002CreateSessionsTable{},
		&migrations.M20260813000003CreateSessionMembersTable{},
		&migrations.M20260813000004CreateDecisionsTable{},
		&migrations.M20260813000005CreateSessionAgendasTable{},
		&migrations.M20260813000006AddAgendaToDecisionsTable{},
		&migrations.M20260813000007ReplaceSessionLocationWithUrl{},
		&migrations.M20260813000008CreateLedgerTables{},
		&migrations.M20260813000009CreateLedgerTransactionsTables{},
		&migrations.M20260814000001AddNotifiedAtToLedgerMembersTable{},
	}
}
