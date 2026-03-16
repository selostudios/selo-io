import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { SELO_ORG_COOKIE } from '@/lib/constants/org-storage'
import { isInternalUser } from '@/lib/permissions'

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

  if (!isInternalUser(userRecord) && userRecord.organization_id !== orgId) {
    redirect(`/${userRecord.organization_id}/dashboard`)
  }

  const cookieStore = await cookies()
  cookieStore.set(SELO_ORG_COOKIE, orgId, {
    path: '/',
    maxAge: 31536000,
    sameSite: 'lax',
  })

  return <>{children}</>
}
