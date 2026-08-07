package config

import (
	"goravel/app/facades"
)

func init() {
	config := facades.Config()
	config.Add("auth", map[string]any{
		// Authentication Defaults
		//
		// This option controls the default authentication "guard"
		// reset options for your application. You may change these defaults
		// as required, but they're a perfect start for most applications.
		"defaults": map[string]any{
			"guard": "user",
		},

		// Authentication Guards
		//
		// Next, you may define every authentication guard for your application.
		// Of course, a great default configuration has been defined for you
		// here which uses session storage and the Eloquent user provider.
		//
		// All authentication drivers have a user provider. This defines how the
		// users are actually retrieved out of your database or other storage
		// mechanisms used by this application to persist your user's data.
		//
		// Supported drivers: "jwt", "session", "telegram-webapp" (custom —
		// registered by app/providers/auth_service_provider.go, verifies
		// Authorization: Bearer <initData> per plan section 5. No session,
		// no login flow — every request is authenticated independently).
		"guards": map[string]any{
			"user": map[string]any{
				"driver":   "telegram-webapp",
				"provider": "user",
			},
		},

		// Supported: "orm". Unused by the telegram-webapp guard (it never
		// calls RetriveByID — WorkDesk doesn't sync/store user data, plan
		// constraint #3), kept only because Goravel's auth resolution
		// requires *a* configured provider to exist for the guard above.
		"providers": map[string]any{
			"user": map[string]any{
				"driver": "orm",
			},
		},
	})
}
