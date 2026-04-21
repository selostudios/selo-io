import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import {
  testDb,
  createTestUser,
  createTestOrganization,
  linkUserToOrganization,
} from '../../../helpers/db'

// The server action under test calls `createClient()` from `lib/supabase/server.ts`.
// In vitest there is no request context and no authenticated session, so the anon
// client would be blocked by RLS on `generated_reports`. Mock `createClient` to
// return the service-role `testDb` client — this lets the action exercise its query
// logic (the focus of this test) without depending on an RLS-authenticated session.
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => testDb,
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`)
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
}))

// Import the action under test AFTER the vi.mock calls above so the mocks are
// registered before the module graph is evaluated. Do not reorder.
import { getReportWithAudits } from '@/app/(authenticated)/[orgId]/reports/audit/actions'

describe('getReportWithAudits — unified-audit report', () => {
  const testId = `report-detail-${Date.now()}`

  let testUser: Awaited<ReturnType<typeof createTestUser>>
  let testOrg: Awaited<ReturnType<typeof createTestOrganization>>
  let auditId: string
  let reportId: string

  beforeAll(async () => {
    testUser = await createTestUser(`${testId}@test.com`, 'password123', {
      first_name: 'Detail',
      last_name: 'Tester',
    })
    testOrg = await createTestOrganization(`Detail Test Org ${testId}`)
    await linkUserToOrganization(testUser.id, testOrg.id, 'admin', 'Detail', 'Tester')

    // Seed a completed unified audit
    const { data: audit, error: auditError } = await testDb
      .from('audits')
      .insert({
        organization_id: testOrg.id,
        created_by: testUser.id,
        domain: 'example.com',
        url: 'https://example.com',
        status: 'completed',
        pages_crawled: 10,
        seo_score: 80,
        performance_score: 75,
        ai_readiness_score: 70,
        overall_score: 75,
      })
      .select('id')
      .single()
    if (auditError) throw new Error(`Failed to create audit: ${auditError.message}`)
    auditId = audit!.id

    // Seed a generated_reports row linked ONLY to the unified audit.
    // Legacy columns (site_audit_id, performance_audit_id, aio_audit_id) stay NULL.
    const { data: report, error: reportError } = await testDb
      .from('generated_reports')
      .insert({
        organization_id: testOrg.id,
        created_by: testUser.id,
        audit_id: auditId,
        domain: 'example.com',
        combined_score: 75,
      })
      .select('id')
      .single()
    if (reportError) throw new Error(`Failed to create report: ${reportError.message}`)
    reportId = report!.id
  })

  afterAll(async () => {
    try {
      if (reportId) {
        await testDb.from('generated_reports').delete().eq('id', reportId)
      }
      if (auditId) {
        await testDb.from('audits').delete().eq('id', auditId)
      }
      if (testUser?.id) {
        await testDb.from('users').delete().eq('id', testUser.id)
        await testDb.auth.admin.deleteUser(testUser.id)
      }
      if (testOrg?.id) {
        await testDb.from('organizations').delete().eq('id', testOrg.id)
      }
    } catch (error) {
      console.error('Cleanup error:', error)
    }
  })

  it('returns the report with organization branding when only audit_id is set', async () => {
    const report = await getReportWithAudits(reportId)

    expect(report).toBeDefined()
    expect(report).not.toBeNull()
    expect(report.id).toBe(reportId)
    expect(report.audit_id).toBe(auditId)
    expect(report.domain).toBe('example.com')

    // Organization branding should be populated by the join
    expect(report.org_name).toBe(`Detail Test Org ${testId}`)
    expect(report.primary_color).toBe('#000000')
  })
})
