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
| `src/app/page.tsx` | Landing + sign-in (Supabase Auth, forgot password) |
| `src/app/reset-password/page.tsx` | Set password from an invitation / reset email, or change it while signed in |
| `src/app/(app)/layout.tsx` | Auth guard, sidebar, topbar, matter detail panel, modals |
| `src/app/(app)/<page>/page.tsx` | dashboard, kanban, list, calendar, team, tasks, clients, chat, billing, settings |
| `src/components/store.tsx` | All app state + every database read/write + realtime subscriptions |
| `src/lib/db.ts` | Supabase row ↔ app object converters and queries |
| `src/lib/constants.ts` | Practice areas, statuses, matter types |
| `scripts/invite-team.mjs` | One-time: email an invitation to every team member (run locally with the service key) |
| `src/app/globals.css` | The original stylesheet, unchanged apart from removing two rules browsers were already discarding |

## Security model

- Sign-in is **Supabase Auth** (email + password). No passwords or hashes exist in this code.
- The team list lives in the `team_members` table; a person's Auth email must match their `email` there.
- **Row-level security** on every table: only signed-in team members can read or write anything. Private matters
  are visible only to their creator and admins, DMs only to the two people in them, the billing channel only to
  billing users; only admins can delete matters or change the team.
- The publishable key in the browser is safe on its own — without a signed-in member session it can do nothing.

## Rollout (one time, in this order)

1. **Supabase → SQL Editor:** run `supabase/migrations/001_matter_fields.sql`, then `002_auth_and_rls.sql`.
   From this moment the old HTML page and older builds stop working — deploy step 3 right away.
2. **Supabase → Authentication:**
   - *Sign In / Providers → Email:* turn **off** "Allow new users to sign up" (only invited people get in).
   - *URL Configuration:* Site URL = your Vercel URL; add Redirect URLs
     `https://<your-app>.vercel.app/reset-password` and `http://localhost:3000/reset-password`.
3. **Deploy** this version to Vercel.
4. **Invite the team:** add `SUPABASE_SERVICE_ROLE_KEY` and `APP_URL` to `.env.local` (local only — never Vercel,
   never git), then `node --env-file=.env.local scripts/invite-team.mjs --dry` to preview and without `--dry` to send.
   Everyone gets an email, clicks it, and chooses their own password. Later hires: add them in
   Settings → Team, then *Authentication → Users → Invite user* (or re-run the script).

## Database tables used

`projects`, `tasks`, `clients`, `activity`, `messages` (realtime enabled on all of them).

## Notes

- Billing rates and exchange rates are not stored (as in the original); the billing page itself is shown only to
  billing users, but time logs live on matters, which every member can read.
