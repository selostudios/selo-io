import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { decryptCredentials } from '@/lib/utils/crypto'
import { getPlatformDisplayName } from '@/lib/oauth/utils'
import type { Account } from '@/lib/oauth/types'
import { SelectAccountContent } from './select-account-content'

interface PendingOAuthData {
  platform: string
  tokens: {
    access_token: string
    refresh_token: string
    expires_at: string
    scopes: string[]
  }
  accounts: Account[]
}

interface PageProps {
  params: Promise<{ orgId: string }>
  searchParams: Promise<{ platform?: string }>
}

export default async function SelectAccountPage({ params, searchParams }: PageProps) {
  const { orgId } = await params
  const { platform } = await searchParams

  const cookieStore = await cookies()
  const pendingCookie = cookieStore.get('oauth_pending_tokens')?.value

  if (!pendingCookie) {
    redirect(`/${orgId}/settings/integrations?error=${encodeURIComponent('OAuth session expired. Please try connecting again.')}`)
  }

  let pending: PendingOAuthData
  try {
    pending = decryptCredentials<PendingOAuthData>(pendingCookie)
  } catch {
    redirect(`/${orgId}/settings/integrations?error=${encodeURIComponent('Invalid OAuth session. Please try connecting again.')}`)
  }

  const platformName = getPlatformDisplayName(platform || pending.platform)

  return (
    <SelectAccountContent
      accounts={pending.accounts}
      platformName={platformName}
      orgId={orgId}
    />
  )
}
