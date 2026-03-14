'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/supabase/client'

interface CounterProps {
  isAnonymous: boolean
  user: User | undefined
}

function getStoredCounter(user: User | undefined) {
  const counter = user?.user_metadata?.counter

  return typeof counter === 'number' ? counter : 0
}

export function Counter({ isAnonymous, user }: CounterProps) {
  const supabase = useMemo(() => createClient(), [])
  const [count, setCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setCount(getStoredCounter(user))
  }, [user])

  const updateCounter = useCallback(
    async (nextValue: number) => {
      if (!user) {
        return
      }

      setIsSaving(true)
      setError(null)

      try {
        const { data, error: updateError } = await supabase.auth.updateUser({
          data: { counter: nextValue },
        })

        if (updateError) {
          throw updateError
        }

        const persistedCount = getStoredCounter(data.user ?? user)
        setCount(persistedCount)
      } catch (counterError) {
        setError(
          counterError instanceof Error
            ? counterError.message
            : 'Failed to update the counter.',
        )
      } finally {
        setIsSaving(false)
      }
    },
    [supabase, user],
  )

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Guest Counter</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="text-5xl font-bold tabular-nums">{count}</div>
        <div className="flex gap-2">
          <Button
            onClick={() => updateCounter(count - 1)}
            disabled={isSaving || !user}
            variant="outline"
          >
            -
          </Button>
          <Button
            onClick={() => updateCounter(0)}
            disabled={isSaving || !user}
            variant="secondary"
          >
            Reset
          </Button>
          <Button onClick={() => updateCounter(count + 1)} disabled={isSaving || !user}>
            +
          </Button>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          {isSaving
            ? 'Saving your counter...'
            : isAnonymous
              ? 'This value is stored in your guest session metadata.'
              : 'This value stays attached to your account metadata.'}
        </p>
        {error ? <p className="text-center text-sm text-red-500">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
