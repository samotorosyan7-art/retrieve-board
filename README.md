# Retrieve · Legal Practice Management

Next.js (App Router) port of `retrieve am platform.html`. There is no API layer — the browser talks
to Supabase directly with the publishable key, exactly like the original page.

## Run

```bash
npm install
cp .env.example .env.local   # already filled in for this project
npm run dev                  # http://localhost:3000
```

## Layout

| Path | What |
|---|---|
| `src/app/page.tsx` | Landing + sign-in (SHA-256 hashed credentials, lockout after 5 failures) |
| `src/app/(app)/layout.tsx` | Auth guard, sidebar, topbar, matter detail panel, modals |
| `src/app/(app)/<page>/page.tsx` | dashboard, kanban, list, calendar, team, tasks, clients, chat, billing, settings |
| `src/components/store.tsx` | All app state + every database read/write + realtime subscriptions |
| `src/lib/db.ts` | Supabase row ↔ app object converters and queries |
| `src/lib/constants.ts` | Team, practice areas, statuses, seed data (fallback when the DB is unreachable) |
| `src/app/globals.css` | The original stylesheet, unchanged apart from removing two rules browsers were already discarding |

## One-time database migration

Run [`supabase/migrations/001_matter_fields.sql`](supabase/migrations/001_matter_fields.sql) in Supabase → SQL Editor.
It adds `matter_type`, `is_private` and `created_by` to `projects`. The app detects the columns automatically;
until they exist, matter type and privacy are remembered only in the browser that set them.

## Database tables used

`projects`, `tasks`, `clients`, `activity`, `messages` (realtime enabled on all of them).

## Known limitations carried over from the original

- Team members and credentials live in code (`constants.ts`, `auth.ts`); members added in Settings last until reload.
- Matter type and privacy are per-browser only until the migration above is run.
