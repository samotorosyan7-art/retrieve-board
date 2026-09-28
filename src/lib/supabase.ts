import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Project URL + publishable key are public by design (they ship to every browser) and are safe to commit:
// row-level security (migration 002) means they grant nothing without a signed-in team member.
// Environment variables override them, e.g. to point a preview deployment at another project.
// Never put the secret / service-role key here.
const DEFAULT_URL = 'https://lvtipqzcupegawhufzsw.supabase.co';
const DEFAULT_KEY = 'sb_publishable_J8YC4rtR3fqhkSFFG5cBJg_FRP0jmN7';

let client: SupabaseClient | null = null;

/** Browser-side Supabase client (publishable key). */
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_KEY || DEFAULT_KEY;
  client = createClient(url, key);
  return client;
}
