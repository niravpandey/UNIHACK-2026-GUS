import { redirect } from 'next/navigation'

import { FetchDataSteps } from '@/components/tutorial/fetch-data-steps'
import { createClient } from '@/supabase/server'
import { InfoIcon } from 'lucide-react'

async function UserDetails() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user || user.is_anonymous) {
    redirect('/auth/login')
  }

  return JSON.stringify(
    {
      email: user.email,
      id: user.id,
      is_anonymous: user.is_anonymous,
      user_metadata: user.user_metadata,
    },
    null,
    2,
  )
}

export default function ProtectedPage() {
  return (
    <div className="flex w-full flex-1 flex-col gap-12">
      <div className="w-full">
        <div className="bg-accent text-foreground flex items-center gap-3 rounded-md p-3 px-5 text-sm">
          <InfoIcon size="16" strokeWidth={2} />
          This page is reserved for upgraded accounts with a verified email and password.
        </div>
      </div>
      <div className="flex flex-col items-start gap-2">
        <h2 className="mb-4 text-2xl font-bold">Your user details</h2>
        <pre className="max-h-32 overflow-auto rounded border p-3 font-mono text-xs">
          <UserDetails />
        </pre>
      </div>
      <div>
        <h2 className="mb-4 text-2xl font-bold">Next steps</h2>
        <FetchDataSteps />
      </div>
    </div>
  )
}
