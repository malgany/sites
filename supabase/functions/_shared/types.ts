export type SupabaseError = {
  message: string
}

export type JsonRecord = Record<string, unknown>

export type SupabaseMutationResponse = {
  error: SupabaseError | null
}

export type SupabaseSingleResponse<T extends JsonRecord> = {
  data: T | null
  error: SupabaseError | null
}

export type TableQueryBuilder<T extends JsonRecord = JsonRecord> = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<SupabaseSingleResponse<T>>
    }
  }
  update: (values: JsonRecord) => {
    eq: (column: string, value: string) => Promise<SupabaseMutationResponse>
  }
  upsert: (
    values: JsonRecord,
    options?: {
      onConflict?: string
    },
  ) => Promise<SupabaseMutationResponse>
}

export type ServiceClient = {
  from: <T extends JsonRecord = JsonRecord>(table: string) => TableQueryBuilder<T>
}

export type AuthenticatedUser = {
  email?: string | null
  id: string
}

export type UserClient = {
  auth: {
    getUser: () => Promise<{
      data: {
        user: AuthenticatedUser | null
      }
      error: SupabaseError | null
    }>
  }
}
