'use client'

import Link from 'next/link'

import { Counter } from '@/components/counter'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useSession } from '@/hooks/useSession'

export function GuestSessionPanel() {
  const { authState, error, isAnonymous, isLoading, user } = useSession()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Starting session</CardTitle>
          <CardDescription>Preparing an anonymous Supabase session.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>Anonymous sessions</CardTitle>
            <Badge variant={isAnonymous ? 'secondary' : 'default'}>
              {isAnonymous ? 'Guest session' : 'Authenticated'}
            </Badge>
          </div>
          <CardDescription>
            New visitors receive a persistent anonymous session before they sign up.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground">Auth state</p>
            <p className="font-mono">{authState}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">User ID</p>
            <p className="break-all font-mono text-xs">{user?.id ?? 'No active user'}</p>
          </div>
          {isAnonymous ? (
            <p className="text-muted-foreground">
              You are browsing as a guest. Visit{' '}
              <Link href="/auth/login" className="underline underline-offset-4">
                the login page
              </Link>{' '}
              to upgrade this session with an email and password.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Your guest session has already been upgraded. Continue to{' '}
              <Link href="/protected" className="underline underline-offset-4">
                the protected page
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>
      <Counter isAnonymous={isAnonymous} user={user} />
    </section>
  )
}
