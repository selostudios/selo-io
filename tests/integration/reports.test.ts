import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { testDb, createTestUser, createTestOrganization, linkUserToOrganization } from '../helpers/db'

describe('Reports Database Operations', () => {
  let testUser: { id: string }
  let testOrg: { id: string }
  let testSiteAudit: { id: string }
  let testPerformanceAudit: { id: string }
  let testAIOAudit: { id: string }

  const testId = `reports-${Date.now()}`

  beforeAll(async () => {
    // Create test user and organization
    testUser = await createTestUser(`report-${testId}@test.com`, 'password123', {
      first_name: 'Report',
      last_name: 'Tester',
    })
    testOrg = await createTestOrganization(`Report Test Org ${testId}`)
    await linkUserToOrganization(testUser.id, testOrg.id, 'admin', 'Report', 'Tester')

    // Create test site audit
    const { data: siteAudit, error: siteError } = await testDb
      .from('site_audits')
      .insert({
        organization_id: testOrg.id,
        url: 'https://example.com',
        status: 'completed',
        urls_discovered: 10,
        pages_crawled: 10,
        overall_score: 85,
        seo_score: 90,
        ai_readiness_score: 80,
        technical_score: 85,
      })
      .select()
      .single()
    if (siteError) throw new Error(`Failed to create site audit: ${siteError.message}`)
    testSiteAudit = siteAudit!

    // Create test performance audit
    const { data: perfAudit, error: perfError } = await testDb
      .from('performance_audits')
      .insert({
        organization_id: testOrg.id,
        created_by: testUser.id,
        status: 'completed',
        total_urls: 1,
        completed_count: 1,
        current_url: 'https://example.com',
      })
      .select()
      .single()
    if (perfError) throw new Error(`Failed to create performance audit: ${perfError.message}`)
    testPerformanceAudit = perfAudit!

    // Create performance result
    await testDb.from('performance_audit_results').insert({
      audit_id: testPerformanceAudit.id,
      url: 'https://example.com',
      device: 'desktop',
      performance_score: 90,
      accessibility_score: 95,
      best_practices_score: 100,
      seo_score: 92,
    })

    // Create test AIO audit
    const { data: aioAudit, error: aioError } = await testDb
      .from('aio_audits')
      .insert({
        organization_id: testOrg.id,
        created_by: testUser.id,
        url: 'https://example.com',
        status: 'completed',
        overall_aio_score: 75,
        technical_score: 80,
        strategic_score: 70,
      })
      .select()
      .single()
    if (aioError) throw new Error(`Failed to create AIO audit: ${aioError.message}`)
    testAIOAudit = aioAudit!
  })

  afterAll(async () => {
    // Clean up in reverse order of dependencies
    try {
      if (testOrg?.id) {
        // Delete reports and shares first
        const { data: reports } = await testDb
          .from('generated_reports')
          .select('id')
          .eq('organization_id', testOrg.id)

        if (reports) {
          for (const report of reports) {
            await testDb.from('report_shares').delete().eq('report_id', report.id)
          }
        }
        await testDb.from('generated_reports').delete().eq('organization_id', testOrg.id)
      }

      if (testPerformanceAudit?.id) {
        await testDb.from('performance_audit_results').delete().eq('audit_id', testPerformanceAudit.id)
      }
      if (testAIOAudit?.id) {
        await testDb.from('aio_checks').delete().eq('audit_id', testAIOAudit.id)
        await testDb.from('aio_audits').delete().eq('id', testAIOAudit.id)
      }
      if (testPerformanceAudit?.id) {
        await testDb.from('performance_audits').delete().eq('id', testPerformanceAudit.id)
      }
      if (testSiteAudit?.id) {
        await testDb.from('site_audit_checks').delete().eq('audit_id', testSiteAudit.id)
        await testDb.from('site_audit_pages').delete().eq('audit_id', testSiteAudit.id)
        await testDb.from('site_audits').delete().eq('id', testSiteAudit.id)
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

  describe('Report creation', () => {
    let createdReportId: string | null = null

    afterAll(async () => {
      if (createdReportId) {
        await testDb.from('report_shares').delete().eq('report_id', createdReportId)
        await testDb.from('generated_reports').delete().eq('id', createdReportId)
      }
    })

    it('creates a report with all required audit references', async () => {
      const { data, error } = await testDb
        .from('generated_reports')
        .insert({
          organization_id: testOrg.id,
          created_by: testUser.id,
          site_audit_id: testSiteAudit.id,
          performance_audit_id: testPerformanceAudit.id,
          aio_audit_id: testAIOAudit.id,
          domain: 'example.com',
          combined_score: 84,
          executive_summary: 'Test summary',
        })
        .select()
        .single()

      createdReportId = data?.id ?? null

      expect(error).toBeNull()
      expect(data).toMatchObject({
        organization_id: testOrg.id,
        site_audit_id: testSiteAudit.id,
        performance_audit_id: testPerformanceAudit.id,
        aio_audit_id: testAIOAudit.id,
        domain: 'example.com',
        combined_score: 84,
        view_count: 0,
      })
    })

    it('sets default view_count to 0', async () => {
      const { data } = await testDb
        .from('generated_reports')
        .insert({
          organization_id: testOrg.id,
          created_by: testUser.id,
          site_audit_id: testSiteAudit.id,
          performance_audit_id: testPerformanceAudit.id,
          aio_audit_id: testAIOAudit.id,
          domain: 'example.com',
          combined_score: 84,
        })
        .select()
        .single()

      expect(data?.view_count).toBe(0)

      // Cleanup
      if (data?.id) {
        await testDb.from('generated_reports').delete().eq('id', data.id)
      }
    })
  })

  describe('Report updates', () => {
    let reportId: string

    beforeEach(async () => {
      const { data } = await testDb
        .from('generated_reports')
        .insert({
          organization_id: testOrg.id,
          created_by: testUser.id,
          site_audit_id: testSiteAudit.id,
          performance_audit_id: testPerformanceAudit.id,
          aio_audit_id: testAIOAudit.id,
          domain: 'example.com',
          combined_score: 84,
          executive_summary: 'Original summary',
          original_executive_summary: 'Original summary',
        })
        .select()
        .single()
      reportId = data!.id
    })

    afterEach(async () => {
      await testDb.from('generated_reports').delete().eq('id', reportId)
    })

    it('updates executive summary', async () => {
      const { data, error } = await testDb
        .from('generated_reports')
        .update({ executive_summary: 'Updated summary' })
        .eq('id', reportId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.executive_summary).toBe('Updated summary')
      expect(data?.original_executive_summary).toBe('Original summary')
    })

    it('updates white-label branding', async () => {
      const { data, error } = await testDb
        .from('generated_reports')
        .update({
          custom_logo_url: 'https://example.com/logo.png',
          custom_company_name: 'Custom Agency',
        })
        .eq('id', reportId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.custom_logo_url).toBe('https://example.com/logo.png')
      expect(data?.custom_company_name).toBe('Custom Agency')
    })

    it('increments view_count', async () => {
      // Get initial count
      const { data: before } = await testDb
        .from('generated_reports')
        .select('view_count')
        .eq('id', reportId)
        .single()

      // Increment
      await testDb
        .from('generated_reports')
        .update({ view_count: (before?.view_count ?? 0) + 1 })
        .eq('id', reportId)

      const { data: after } = await testDb
        .from('generated_reports')
        .select('view_count')
        .eq('id', reportId)
        .single()

      expect(after?.view_count).toBe(1)
    })
  })

  describe('Report queries with audits', () => {
    let reportId: string

    beforeAll(async () => {
      const { data } = await testDb
        .from('generated_reports')
        .insert({
          organization_id: testOrg.id,
          created_by: testUser.id,
          site_audit_id: testSiteAudit.id,
          performance_audit_id: testPerformanceAudit.id,
          aio_audit_id: testAIOAudit.id,
          domain: 'example.com',
          combined_score: 84,
        })
        .select()
        .single()
      reportId = data!.id
    })

    afterAll(async () => {
      await testDb.from('generated_reports').delete().eq('id', reportId)
    })

    it('fetches report with related audits', async () => {
      const { data, error } = await testDb
        .from('generated_reports')
        .select(`
          *,
          site_audit:site_audits(*),
          performance_audit:performance_audits(*),
          aio_audit:aio_audits(*)
        `)
        .eq('id', reportId)
        .single()

      expect(error).toBeNull()
      expect(data?.site_audit).toBeDefined()
      expect(data?.site_audit?.url).toBe('https://example.com')
      expect(data?.performance_audit).toBeDefined()
      expect(data?.aio_audit).toBeDefined()
    })
  })

  describe('Report shares', () => {
    let reportId: string
    let shareId: string | null = null

    beforeAll(async () => {
      const { data } = await testDb
        .from('generated_reports')
        .insert({
          organization_id: testOrg.id,
          created_by: testUser.id,
          site_audit_id: testSiteAudit.id,
          performance_audit_id: testPerformanceAudit.id,
          aio_audit_id: testAIOAudit.id,
          domain: 'example.com',
          combined_score: 84,
        })
        .select()
        .single()
      reportId = data!.id
    })

    afterAll(async () => {
      if (shareId) {
        await testDb.from('report_shares').delete().eq('id', shareId)
      }
      await testDb.from('generated_reports').delete().eq('id', reportId)
    })

    it('creates share link with token', async () => {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      const { data, error } = await testDb
        .from('report_shares')
        .insert({
          report_id: reportId,
          token: `test-token-${Date.now()}`,
          expires_at: expiresAt.toISOString(),
          max_views: 50,
        })
        .select()
        .single()

      shareId = data?.id ?? null

      expect(error).toBeNull()
      expect(data?.token).toBeDefined()
      expect(data?.view_count).toBe(0)
      expect(data?.max_views).toBe(50)
    })

    it('tracks view count on shares', async () => {
      // Create a fresh share for this test
      const token = `test-token-views-${Date.now()}`
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      const { data: share } = await testDb
        .from('report_shares')
        .insert({
          report_id: reportId,
          token,
          expires_at: expiresAt.toISOString(),
          max_views: 50,
        })
        .select()
        .single()

      // Increment view count
      await testDb
        .from('report_shares')
        .update({
          view_count: (share?.view_count ?? 0) + 1,
          last_viewed_at: new Date().toISOString(),
        })
        .eq('id', share?.id)

      const { data: updated } = await testDb
        .from('report_shares')
        .select('view_count, last_viewed_at')
        .eq('id', share?.id)
        .single()

      expect(updated?.view_count).toBe(1)
      expect(updated?.last_viewed_at).toBeDefined()

      // Cleanup
      await testDb.from('report_shares').delete().eq('id', share?.id)
    })

    it('validates token lookup', async () => {
      const token = `test-lookup-${Date.now()}`
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      await testDb
        .from('report_shares')
        .insert({
          report_id: reportId,
          token,
          expires_at: expiresAt.toISOString(),
          max_views: 50,
        })

      const { data, error } = await testDb
        .from('report_shares')
        .select('*, report:generated_reports(*)')
        .eq('token', token)
        .single()

      expect(error).toBeNull()
      expect(data?.report).toBeDefined()
      expect(data?.report?.domain).toBe('example.com')

      // Cleanup
      await testDb.from('report_shares').delete().eq('token', token)
    })
  })

  describe('Cascade delete behavior', () => {
    it('deletes shares when report is deleted', async () => {
      // Create report
      const { data: report } = await testDb
        .from('generated_reports')
        .insert({
          organization_id: testOrg.id,
          created_by: testUser.id,
          site_audit_id: testSiteAudit.id,
          performance_audit_id: testPerformanceAudit.id,
          aio_audit_id: testAIOAudit.id,
          domain: 'example.com',
          combined_score: 84,
        })
        .select()
        .single()

      // Create share
      const { data: share } = await testDb
        .from('report_shares')
        .insert({
          report_id: report!.id,
          token: `cascade-test-${Date.now()}`,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          max_views: 50,
        })
        .select()
        .single()

      // Delete report
      await testDb.from('generated_reports').delete().eq('id', report!.id)

      // Verify share was deleted
      const { data: orphanedShare } = await testDb
        .from('report_shares')
        .select()
        .eq('id', share!.id)
        .single()

      expect(orphanedShare).toBeNull()
    })
  })
})
