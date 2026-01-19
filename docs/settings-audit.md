# Settings Audit

| Setting | UI exists | Works now | Persistence | Notes | Fix |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Profile** | | | | | |
| Goals Button | Yes | Yes | N/A | Opens Goals modal | None |
| Name Display | Yes | Yes | Auth | Shows user display name/email | None |
| **Account** | | | | | |
| Email Display | Yes | Yes | Auth | Shows user email | None |
| Logout | Yes | Yes | Auth | Logs out user | None |
| Delete Profile | Yes | Yes | Backend | Calls `clearUserScopedData` | None |
| **Notifications** | | | | | |
| Training Reminders | Yes | Partial | LocalStorage | `trainq_notif_training` | Ensure meaningful effect or hide |
| Weekly Summary | Yes | Partial | LocalStorage | `trainq_notif_weekly` | Ensure meaningful effect or hide |
| **Integrations** | | | | | |
| Garmin Connect | Yes | No | N/A | Mock UI only | Connect to backend OAuth |
| **Units** | | | | | |
| Metric/Imperial | Yes | Yes | LocalStorage | `trainq_units`. UI state logic inline. | Refactor to hook |
| **Language** | | | | | |
| DE/EN Toggle | Yes | Yes | Custom | Uses custom i18n implementation | Migrate to `react-i18next` |
| **Theme** | | | | | |
| Light/Dark Button | Yes | Partial | LocalStorage | `trainq_theme_v1`. `dark` class added but tailwind config missing `darkMode: 'class'` | Add `darkMode: 'class'` to tailwind config. Fix white cards in dark mode. |
| **Pro** | | | | | |
| Status Indicator | Yes | Yes | Entitlements | | None |
| Buy Button | Yes | Yes | RevenueCat | | None |
| Restore Purchases | Yes | Yes | RevenueCat | | None |
| **Data** | | | | | |
| Clear Calendar | Yes | Yes | LocalStorage | | None |
| Clear History | Yes | Yes | IndexedDB | | None |
| **Legal** | | | | | |
| Privacy Link | Yes | Yes | Route | Links to `/privacy` | Verify content |
| Imprint Link | Yes | Yes | Route | Links to `/impressum` | Verify content |
| Terms Link | Yes | Yes | Route | Links to `/terms` | Verify content |
| **Help** | | | | | |
| Contact Support | Yes | Yes | mailto | | None |
