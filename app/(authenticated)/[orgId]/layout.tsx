import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { SELO_ORG_COOKIE } from '@/lib/constants/org-storage'
import { canAccessOrg } from '@/lib/permissions'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params

  if (!UUID_REGEX.test(orgId)) {
    notFound()
  }

  const user = await getAuthUser()
  if (!user) {
    redirect('/login')
  }

  const userRecord = await getUserRecord(user.id)
  if (!userRecord) {
    redirect('/onboarding')
  }

  if (!canAccessOrg(userRecord, orgId)) {
    // Cookie is client-controlled — only trust it if the user actually has that membership.
    const cookieOrgId = (await cookies()).get(SELO_ORG_COOKIE)?.value
    const fallbackOrgId =
      (cookieOrgId && canAccessOrg(userRecord, cookieOrgId) ? cookieOrgId : null) ??
      userRecord.memberships[0]?.organization_id ??
      null

    redirect(fallbackOrgId ? `/${fallbackOrgId}/dashboard` : '/onboarding')
  }

  // Cookie is set by the proxy (proxy.ts) on every request with a UUID path segment
  return <>{children}</>
}
