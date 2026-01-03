import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization:organizations(name)')
    .eq('id', user!.id)
    .single()

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">
        Welcome to {userRecord?.organization?.name || 'Selo IO'}
      </h1>
      <p className="mt-4 text-muted-foreground">
        Dashboard coming soon...
      </p>
    </div>
  )
}
