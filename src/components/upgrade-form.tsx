'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/supabase/client'
import { cn } from '@/utils/tailwind'

interface UpgradeFormProps extends React.ComponentPropsWithoutRef<'div'> {
  onBack?: () => void
}

export function UpgradeForm({ className, onBack, ...props }: UpgradeFormProps) {
  const supabase = useMemo(() => createClient(), [])
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleUpgrade = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { error: updateError } = await supabase.auth.updateUser(
        { email },
        {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/auth/set-password`,
        },
      )

      if (updateError) {
        throw updateError
      }

      setEmailSent(true)
    } catch (upgradeError) {
      setError(
        upgradeError instanceof Error
          ? upgradeError.message
          : 'An error occurred while sending the verification email.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className={cn('flex flex-col gap-6', className)} {...props}>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription>
              We sent a verification link to <strong>{email}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Open the link in that email to confirm the address, then choose a password
              to finish upgrading this guest account.
            </p>
            {onBack ? (
              <Button type="button" variant="outline" onClick={onBack}>
                Back to login
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Upgrade your account</CardTitle>
          <CardDescription>
            Attach an email to this guest session before you set a password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpgrade}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="upgrade-email">Email</Label>
                <Input
                  id="upgrade-email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              {error ? <p className="text-sm text-red-500">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Sending verification email...' : 'Send verification email'}
              </Button>
              {onBack ? (
                <Button type="button" variant="ghost" onClick={onBack}>
                  Back
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
