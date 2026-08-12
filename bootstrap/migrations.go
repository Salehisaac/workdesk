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
	}
}
