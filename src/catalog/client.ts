import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseBrowserEnv } from '../lib/supabaseEnv'

let browserSupabaseClient: SupabaseClient | null = null

export function getBrowserSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseBrowserEnv()

  if (!browserSupabaseClient) {
    browserSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    })
  }

  return browserSupabaseClient
}
