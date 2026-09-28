import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** Browser-side Supabase client (publishable key). Returns null if env vars are missing. */
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_KEY;
  if (!url || !key) {
    console.error('Supabase env vars missing — running on local cache only');
    return null;
  }
  client = createClient(url, key);
  return client;
}
