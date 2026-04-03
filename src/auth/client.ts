import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseBrowserEnv } from '../lib/supabaseEnv'

let browserAuthSupabaseClient: SupabaseClient | null = null

export function getBrowserAuthSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseBrowserEnv()

  if (!browserAuthSupabaseClient) {
    browserAuthSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        storageKey: 'prompt-archive-auth',
      },
    })
  }

  return browserAuthSupabaseClient
}
