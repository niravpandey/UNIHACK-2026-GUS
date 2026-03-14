import { redirect } from 'next/navigation'

import { SetPasswordForm } from '@/components/set-password-form'
import { createClient } from '@/supabase/server'

export default async function SetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <SetPasswordForm />
      </div>
    </div>
  )
}
