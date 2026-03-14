import Link from 'next/link'

import { createClient } from '@/supabase/server'

import { LogoutButton } from './logout-button'
import { Button } from './ui/button'

export async function AuthButton() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user ? (
    <div className="flex items-center gap-4">
      <span>
        {user.is_anonymous ? 'Guest session' : `Hey, ${user.email ?? 'there'}!`}
      </span>
      {user.is_anonymous ? (
        <Button asChild size="sm" variant="outline">
          <Link href="/auth/login">Upgrade</Link>
        </Button>
      ) : null}
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant="outline">
        <Link href="/auth/login">Sign in</Link>
      </Button>
      <Button asChild size="sm" variant="default">
        <Link href="/auth/sign-up">Sign up</Link>
      </Button>
    </div>
  )
}
