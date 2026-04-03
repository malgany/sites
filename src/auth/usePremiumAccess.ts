import { startTransition, useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { PremiumAccessState } from '../types'
import {
  getAuthenticatedPremiumAccessState,
  getSignedOutPremiumAccessState,
  loadPremiumAccessState,
} from './access'
import { getBrowserAuthSupabaseClient } from './client'

type UsePremiumAccessResult = {
  accessState: PremiumAccessState
  errorMessage: string | null
  isLoading: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
  userEmail: string | null
}

export function usePremiumAccess(): UsePremiumAccessResult {
  const authClient = getBrowserAuthSupabaseClient()
  const [accessState, setAccessState] = useState<PremiumAccessState>(() =>
    getSignedOutPremiumAccessState(),
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false

    async function syncAccess(user: User | null) {
      if (!user) {
        if (isCancelled) {
          return
        }

        startTransition(() => {
          setAccessState(getSignedOutPremiumAccessState())
          setErrorMessage(null)
          setUserEmail(null)
        })
        setIsLoading(false)
        return
      }

      try {
        const nextAccessState = await loadPremiumAccessState(authClient, user)

        if (isCancelled) {
          return
        }

        startTransition(() => {
          setAccessState(nextAccessState)
          setErrorMessage(null)
          setUserEmail(user.email ?? null)
        })
      } catch (error) {
        console.error('Could not load premium access state.', error)

        if (isCancelled) {
          return
        }

        startTransition(() => {
          setAccessState(getAuthenticatedPremiumAccessState())
          setErrorMessage('Nao foi possivel verificar seu acesso agora.')
          setUserEmail(user.email ?? null)
        })
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    async function syncCurrentSession() {
      try {
        const { data, error } = await authClient.auth.getSession()

        if (error) {
          throw error
        }

        await syncAccess(data.session?.user ?? null)
      } catch (error) {
        console.error('Could not load the current auth session.', error)

        if (isCancelled) {
          return
        }

        startTransition(() => {
          setAccessState(getSignedOutPremiumAccessState())
          setErrorMessage('Nao foi possivel carregar sua sessao.')
          setUserEmail(null)
        })
        setIsLoading(false)
      }
    }

    void syncCurrentSession()

    const {
      data: { subscription },
    } = authClient.auth.onAuthStateChange((_event, session) => {
      setIsLoading(true)
      void syncAccess(session?.user ?? null)
    })

    return () => {
      isCancelled = true
      subscription.unsubscribe()
    }
  }, [authClient])

  const refresh = useCallback(async () => {
    setIsLoading(true)

    try {
      const { data, error } = await authClient.auth.getSession()

      if (error) {
        throw error
      }

      const user = data.session?.user ?? null

      if (!user) {
        startTransition(() => {
          setAccessState(getSignedOutPremiumAccessState())
          setErrorMessage(null)
          setUserEmail(null)
        })
        return
      }

      const nextAccessState = await loadPremiumAccessState(authClient, user)

      startTransition(() => {
        setAccessState(nextAccessState)
        setErrorMessage(null)
        setUserEmail(user.email ?? null)
      })
    } catch (error) {
      console.error('Could not refresh premium access state.', error)
      startTransition(() => {
        setErrorMessage('Nao foi possivel atualizar seu acesso.')
      })
    } finally {
      setIsLoading(false)
    }
  }, [authClient])

  const signOut = useCallback(async () => {
    const { error } = await authClient.auth.signOut()

    if (error) {
      throw new Error(error.message || 'Could not sign out.')
    }
  }, [authClient])

  return {
    accessState,
    errorMessage,
    isLoading,
    refresh,
    signOut,
    userEmail,
  }
}
