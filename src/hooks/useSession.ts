'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'

import { createClient } from '@/supabase/client'

export type AuthState =
  | 'anonymous'
  | 'authenticated'
  | 'pending'
  | 'unauthenticated'
  | 'error'

function getAuthState(session: Session | null): AuthState {
  if (!session?.user) {
    return 'unauthenticated'
  }

  return session.user.is_anonymous ? 'anonymous' : 'authenticated'
}

export function useSession() {
  const supabase = useMemo(() => createClient(), [])
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | undefined>(undefined)
  const [authState, setAuthState] = useState<AuthState>('pending')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const applySession = (nextSession: Session | null) => {
      if (!isMounted) {
        return
      }

      setSession(nextSession)
      setUser(nextSession?.user ?? undefined)
      setAuthState(getAuthState(nextSession))
    }

    const signInAnonymously = async () => {
      const { data, error: signInError } = await supabase.auth.signInAnonymously()

      if (signInError) {
        throw signInError
      }

      applySession(data.session)
    }

    const initSession = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const {
          data: { session: existingSession },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          throw sessionError
        }

        if (existingSession) {
          applySession(existingSession)
          return
        }

        await signInAnonymously()
      } catch (sessionError) {
        if (!isMounted) {
          return
        }

        setError(
          sessionError instanceof Error
            ? sessionError.message
            : 'An error occurred while starting the session.',
        )
        setAuthState('error')
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      applySession(nextSession)

      if (!nextSession && event === 'SIGNED_OUT') {
        void signInAnonymously().catch((sessionError) => {
          if (!isMounted) {
            return
          }

          setError(
            sessionError instanceof Error
              ? sessionError.message
              : 'An error occurred while starting the session.',
          )
          setAuthState('error')
        })
      }
    })

    void initSession()

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  return {
    session,
    user,
    isAnonymous: user?.is_anonymous === true,
    authState,
    error,
    isLoading,
  }
}
