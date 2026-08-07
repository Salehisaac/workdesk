package seeders

import (
	"goravel/app/facades"
	"goravel/app/models"
)

// ProjectSeeder seeds two sample projects so the real API has something to
// return immediately. The owner (ref_id "123456789") matches the default
// fake user in scripts/sign_init_data.py, so testing against a freshly
// seeded database "just works" without editing anything.
type ProjectSeeder struct{}

func (s *ProjectSeeder) Signature() string {
	return "ProjectSeeder"
}

func (s *ProjectSeeder) Run() error {
	query := facades.Orm().Query()

	exists, err := query.Model(&models.Project{}).Where("name", "طراحی اپلیکیشن").Exists()
	if err != nil {
		return err
	}
	if exists {
		return nil
	}

	ptr := func(s string) *string { return &s }

	appDesignChatId := "seed-chat-1"
	appDesign := models.Project{
		Name:       "طراحی اپلیکیشن",
		Visibility: models.ProjectVisibilityPrivate,
		ChatId:     &appDesignChatId,
		OwnerType:  "chat",
		OwnerId:    "seed-chat-1",
	}
	if err := query.Create(&appDesign); err != nil {
		return err
	}

	appDesignMembers := []models.ProjectMember{
		{ProjectId: appDesign.ID, RefId: "123456789", RefSource: "users", DisplayName: "Ali Rezaei", Username: ptr("ali"), Online: true, Role: models.ProjectMemberRoleOwner},
		{ProjectId: appDesign.ID, RefId: "101", RefSource: "contacts", DisplayName: "علی رضایی", Username: ptr("ali"), Phone: ptr("989120000001"), Online: true, Role: models.ProjectMemberRoleMember},
		{ProjectId: appDesign.ID, RefId: "102", RefSource: "contacts", DisplayName: "سارا محمدی", Username: ptr("sara"), Online: false, Role: models.ProjectMemberRoleMember},
	}
	if err := query.Create(&appDesignMembers); err != nil {
		return err
	}

	appDesignLists := []models.List{
		{ProjectId: appDesign.ID, Name: "کارهای این هفته"},
		{ProjectId: appDesign.ID, Name: "در حال بررسی"},
	}
	if err := query.Create(&appDesignLists); err != nil {
		return err
	}

	marketingChatId := "seed-chat-2"
	marketing := models.Project{
		Name:       "کمپین بازاریابی",
		Visibility: models.ProjectVisibilityPublic,
		JoinSlug:   ptr("marketing-campaign"),
		ChatId:     &marketingChatId,
		OwnerType:  "chat",
		OwnerId:    "seed-chat-2",
	}
	if err := query.Create(&marketing); err != nil {
		return err
	}

	marketingMembers := []models.ProjectMember{
		{ProjectId: marketing.ID, RefId: "123456789", RefSource: "users", DisplayName: "Ali Rezaei", Username: ptr("ali"), Online: true, Role: models.ProjectMemberRoleOwner},
	}
	return query.Create(&marketingMembers)
}
