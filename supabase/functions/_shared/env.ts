declare const Deno: {
  env: {
    get: (name: string) => string | undefined
  }
}

export function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim()

  if (!value) {
    throw new Error(`Missing ${name}.`)
  }

  return value
}

export function getSupabaseUrl() {
  return getRequiredEnv('SUPABASE_URL')
}

export function getSupabaseAnonKey() {
  return getRequiredEnv('SUPABASE_ANON_KEY')
}

export function getSupabaseServiceRoleKey() {
  return getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
}
