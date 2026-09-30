// Sends a Supabase Auth invitation to every team member who doesn't have a login yet.
// Each person gets an email with a link to /reset-password where they choose their own password.
//
//   node --env-file=.env.local scripts/invite-team.mjs          # send invites
//   node --env-file=.env.local scripts/invite-team.mjs --dry    # just list who would be invited
//
// Admins can also invite one person at a time from the Team page (Add Member / Send login email).
//
// Needs in .env.local (never commit it):
//   SUPABASE_SERVICE_ROLE_KEY=...   (Supabase → Project Settings → API Keys → secret / service_role)
//   APP_URL=https://your-app.vercel.app
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
const dry = process.argv.includes('--dry');

if (!url || !serviceKey) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local'); process.exit(1); }
if (!appUrl && !dry) { console.error('Missing APP_URL in .env.local (the deployed site address, used for the invite link)'); process.exit(1); }

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: team, error: teamErr } = await admin.from('team_members').select('name, email').order('created_at');
if (teamErr) { console.error('Could not read team_members — has migration 002 been run?', teamErr.message); process.exit(1); }

const existing = new Set();
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { console.error(error.message); process.exit(1); }
  data.users.forEach(u => u.email && existing.add(u.email.toLowerCase()));
  if (data.users.length < 1000) break;
}

for (const m of team) {
  const email = m.email.toLowerCase();
  if (existing.has(email)) { console.log(`✓ ${m.name} <${email}> already has a login`); continue; }
  if (dry) { console.log(`→ would invite ${m.name} <${email}>`); continue; }
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${appUrl}/reset-password` });
  console.log(error ? `✗ ${m.name} <${email}>: ${error.message}` : `📧 invited ${m.name} <${email}>`);
}
