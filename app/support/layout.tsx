import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { canManageFeedback } from '@/lib/permissions'

export default async function SupportLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user is a developer
  const { data: userRecord } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userRecord || !canManageFeedback(userRecord.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="border-b bg-white px-6 py-4">
        <h1 className="text-2xl font-bold text-neutral-900">Support</h1>
        <p className="text-sm text-neutral-500">Manage user feedback and issues</p>
      </div>
      <main className="p-6">{children}</main>
    </div>
  )
}
