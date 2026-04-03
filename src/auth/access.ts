import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { PremiumAccessState, PremiumPlanCode, PremiumAccessStatus } from '../types'

type UserAccessRow = {
  plan_code: PremiumPlanCode | null
  status: Exclude<PremiumAccessStatus, 'signed_out'> | null
}

const SIGNED_OUT_PREMIUM_ACCESS_STATE: PremiumAccessState = {
  isAuthenticated: false,
  status: 'signed_out',
  planCode: null,
}

const AUTHENTICATED_DEFAULT_PREMIUM_ACCESS_STATE: PremiumAccessState = {
  isAuthenticated: true,
  status: 'pending',
  planCode: null,
}

export function getSignedOutPremiumAccessState(): PremiumAccessState {
  return SIGNED_OUT_PREMIUM_ACCESS_STATE
}

export function getAuthenticatedPremiumAccessState(): PremiumAccessState {
  return AUTHENTICATED_DEFAULT_PREMIUM_ACCESS_STATE
}

export function hasActivePremiumAccess(accessState: PremiumAccessState) {
  return (
    accessState.isAuthenticated &&
    accessState.status === 'active' &&
    accessState.planCode === 'premium'
  )
}

export function hasPendingPremiumActivation(accessState: PremiumAccessState) {
  return (
    accessState.isAuthenticated &&
    accessState.status === 'pending' &&
    accessState.planCode === 'premium'
  )
}

export function hasRevokedPremiumAccess(accessState: PremiumAccessState) {
  return (
    accessState.isAuthenticated &&
    accessState.status === 'revoked' &&
    accessState.planCode === 'premium'
  )
}

export function canStartPremiumCheckout(accessState: PremiumAccessState) {
  return accessState.isAuthenticated && !hasActivePremiumAccess(accessState)
}

export async function loadPremiumAccessState(
  supabase: SupabaseClient,
  user: User | null | undefined,
) {
  if (!user) {
    return getSignedOutPremiumAccessState()
  }

  const { data, error } = await supabase
    .from('user_access')
    .select('plan_code, status')
    .eq('user_id', user.id)
    .maybeSingle<UserAccessRow>()

  if (error) {
    throw new Error(`Could not load premium access: ${error.message}`)
  }

  if (!data) {
    return getAuthenticatedPremiumAccessState()
  }

  return {
    isAuthenticated: true,
    status: data.status ?? 'pending',
    planCode: data.plan_code ?? null,
  } satisfies PremiumAccessState
}
