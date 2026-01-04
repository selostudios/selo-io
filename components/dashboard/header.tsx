import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UserMenu } from '@/components/dashboard/user-menu'
import { OrgLogo } from '@/components/dashboard/org-logo'

export async function Header() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: userRecord, error } = await supabase
    .from('users')
    .select('organization:organizations(name, logo_url, primary_color), first_name, last_name')
    .eq('id', user.id)
    .single()

  if (error || !userRecord) {
    redirect('/login')
  }

  const org = userRecord?.organization as unknown as {
    name: string
    logo_url: string | null
    primary_color: string | null
  } | null
  const orgName = org?.name || 'Organization'
  const logoUrl = org?.logo_url || null
  const primaryColor = org?.primary_color || null
  const userEmail = user?.email || ''
  const firstName = userRecord?.first_name || userEmail.split('@')[0]
  const lastName = userRecord?.last_name || ''

  // Generate initials from first and last name (or first two chars of firstName if no lastName)
  const initials = lastName
    ? `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
    : firstName.substring(0, 2).toUpperCase()

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div className="flex items-center gap-4">
        <OrgLogo logoUrl={logoUrl} orgName={orgName} primaryColor={primaryColor} size={40} />
        <h2 className="text-lg font-semibold">{orgName}</h2>
      </div>
      <UserMenu
        userEmail={userEmail}
        firstName={firstName}
        lastName={lastName}
        initials={initials}
      />
    </header>
  )
}
