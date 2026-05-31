# Review 1 Code Changelog

This patch focuses on missing scope from Review 1 feedback.

## Added

### Wearable / GPS Device module
Backend:

- `Device` model
- `DeviceRoutePoint` model
- `/api/devices` routes
- Pair device
- Configure device status/settings
- Record route point
- View route history
- Habit analysis summary
- Trigger SOS from wearable/GPS device

Frontend:

- New page: `/devices`
- Sidebar item: `Thiết bị & GPS`
- Pair wearable/GPS device UI
- Demo route point recording
- Wearable SOS trigger
- Movement habit analysis panel

### Album category & AI tag confirmation
Backend:

- `AlbumCategory` model
- Album photo category assignment
- Photo tags and AI status fields
- `/api/album/categories` routes
- `/api/album/:id/category` route

Frontend:

- Category chips and filter on Album page
- Category creation panel for Family Manager
- Upload photo with category and tags
- Preview photo with category and AI tag status
- Assign photo to category from preview modal

### Finance legal wording
Frontend:

- Top-up dialog wording changed to `Family Fund / Internal Ledger` demo wording.
- Avoids presenting the project as a licensed real e-wallet.

## Database migration

Migration file added:

`apps/api/prisma/migrations/20260531143000_review1_wearable_album/migration.sql`

After pulling this code, run:

```bash
pnpm install
pnpm --filter api db:generate
pnpm --filter api db:migrate
pnpm --filter api db:seed
```

If you are using a disposable local database, you can also run:

```bash
pnpm --filter api db:push
pnpm --filter api db:seed
```
