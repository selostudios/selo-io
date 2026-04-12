import { getCurrentUser } from '@/lib/organizations/actions'
import { redirect } from 'next/navigation'
import { getQuickAudits } from './actions'
import { QuickAuditClient } from './client'

export const dynamic = 'force-dynamic'

export default async function QuickAuditPage() {
  const currentUser = await getCurrentUser()

  if (!currentUser) redirect('/login')
  if (!currentUser.isInternal) redirect('/dashboard')

  const audits = await getQuickAudits()

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quick Audit</h1>
        <p className="text-sm text-neutral-500">
          Run a one-time audit on any URL without linking to an organization.
        </p>
      </div>
      <QuickAuditClient audits={audits} />
    </>
  )
}
