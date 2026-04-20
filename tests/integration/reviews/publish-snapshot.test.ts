import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  testDb,
  createTestUser,
  createTestOrganization,
  linkUserToOrganization,
} from '../../helpers/db'

describe('Marketing review snapshots', () => {
  let testUser: { id: string }
  let testOrg: { id: string }
  let reviewId: string
  let draftId: string

  const testId = `review-${Date.now()}`

  beforeAll(async () => {
    testUser = await createTestUser(`review-${testId}@test.com`, 'password123', {
      first_name: 'Review',
      last_name: 'Tester',
    })
    testOrg = await createTestOrganization(`Review Test Org ${testId}`)
    await linkUserToOrganization(testUser.id, testOrg.id, 'admin', 'Review', 'Tester')

    const { data: review, error: reviewErr } = await testDb
      .from('marketing_reviews')
      .insert({
        organization_id: testOrg.id,
        quarter: '2026-Q1',
        title: '2026-Q1 Marketing Review',
        created_by: testUser.id,
      })
      .select('id')
      .single()
    if (reviewErr) throw reviewErr
    reviewId = review!.id

    const { data: draft, error: draftErr } = await testDb
      .from('marketing_review_drafts')
      .insert({
        review_id: reviewId,
        data: { ga: { ga_sessions: { current: 1000, qoq: 900, yoy: 800 } } },
        narrative: { cover_subtitle: 'Draft subtitle' },
        ai_originals: {},
      })
      .select('id')
      .single()
    if (draftErr) throw draftErr
    draftId = draft!.id
  })

  afterAll(async () => {
    try {
      await testDb.from('marketing_review_snapshots').delete().eq('review_id', reviewId)
      await testDb.from('marketing_review_drafts').delete().eq('id', draftId)
      await testDb.from('marketing_reviews').delete().eq('id', reviewId)
      await testDb.from('users').delete().eq('id', testUser.id)
      await testDb.auth.admin.deleteUser(testUser.id)
      await testDb.from('organizations').delete().eq('id', testOrg.id)
    } catch (error) {
      console.error('Cleanup error:', error)
    }
  })

  it('publishing freezes draft data into a snapshot with matching content', async () => {
    const { data: draft } = await testDb
      .from('marketing_review_drafts')
      .select('data, narrative')
      .eq('review_id', reviewId)
      .single()

    const { data: snapshot, error } = await testDb
      .from('marketing_review_snapshots')
      .insert({
        review_id: reviewId,
        version: 1,
        published_by: testUser.id,
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        compare_qoq_start: '2025-10-01',
        compare_qoq_end: '2025-12-31',
        compare_yoy_start: '2025-01-01',
        compare_yoy_end: '2025-03-31',
        data: draft!.data,
        narrative: draft!.narrative,
        share_token: `token-${testId}-v1`,
      })
      .select()
      .single()

    expect(error).toBeNull()
    expect(snapshot!.data).toEqual(draft!.data)
    expect(snapshot!.narrative).toEqual(draft!.narrative)
  })

  it('publishing a second time creates version 2 alongside version 1', async () => {
    const { data: snapshot, error } = await testDb
      .from('marketing_review_snapshots')
      .insert({
        review_id: reviewId,
        version: 2,
        published_by: testUser.id,
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        compare_qoq_start: '2025-10-01',
        compare_qoq_end: '2025-12-31',
        compare_yoy_start: '2025-01-01',
        compare_yoy_end: '2025-03-31',
        data: { ga: { ga_sessions: { current: 2000, qoq: 900, yoy: 800 } } },
        narrative: { cover_subtitle: 'Updated subtitle' },
        share_token: `token-${testId}-v2`,
      })
      .select('version')
      .single()

    expect(error).toBeNull()
    expect(snapshot!.version).toBe(2)

    const { data: allVersions } = await testDb
      .from('marketing_review_snapshots')
      .select('version')
      .eq('review_id', reviewId)
      .order('version', { ascending: true })

    expect(allVersions!.map((r) => r.version)).toEqual([1, 2])
  })

  it('refreshing the draft after publish leaves existing snapshots untouched', async () => {
    const { data: before } = await testDb
      .from('marketing_review_snapshots')
      .select('data, narrative')
      .eq('review_id', reviewId)
      .eq('version', 1)
      .single()

    await testDb
      .from('marketing_review_drafts')
      .update({
        data: { ga: { ga_sessions: { current: 9999, qoq: null, yoy: null } } },
        narrative: { cover_subtitle: 'Newest draft subtitle' },
      })
      .eq('review_id', reviewId)

    const { data: after } = await testDb
      .from('marketing_review_snapshots')
      .select('data, narrative')
      .eq('review_id', reviewId)
      .eq('version', 1)
      .single()

    expect(after!.data).toEqual(before!.data)
    expect(after!.narrative).toEqual(before!.narrative)
  })

  it('share_token is unique across snapshots', async () => {
    const { error } = await testDb.from('marketing_review_snapshots').insert({
      review_id: reviewId,
      version: 3,
      published_by: testUser.id,
      period_start: '2026-01-01',
      period_end: '2026-03-31',
      compare_qoq_start: '2025-10-01',
      compare_qoq_end: '2025-12-31',
      compare_yoy_start: '2025-01-01',
      compare_yoy_end: '2025-03-31',
      data: {},
      narrative: {},
      share_token: `token-${testId}-v1`,
    })

    expect(error).not.toBeNull()
    expect(error!.message.toLowerCase()).toContain('duplicate')
  })
})
