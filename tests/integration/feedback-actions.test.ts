import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  testDb,
  createTestUser,
  createTestOrganization,
  linkUserToOrganization,
} from '../helpers/db'

describe('Feedback Database Operations', () => {
  let testUser: { id: string }
  let testOrg: { id: string }

  beforeAll(async () => {
    // Use unique emails to avoid conflicts with parallel tests
    const testId = `actions-${Date.now()}`

    testUser = await createTestUser(`feedback-${testId}@test.com`, 'password123', {
      first_name: 'Test',
      last_name: 'User',
    })
    testOrg = await createTestOrganization(`Feedback Test Org ${testId}`)
    await linkUserToOrganization(testUser.id, testOrg.id, 'team_member', 'Test', 'User')
  })

  afterAll(async () => {
    // Clean up only data created by this test
    if (testUser?.id) {
      await testDb.from('feedback').delete().eq('submitted_by', testUser.id)
      await testDb.from('users').delete().eq('id', testUser.id)
      await testDb.auth.admin.deleteUser(testUser.id).catch(() => {})
    }
    if (testOrg?.id) {
      await testDb.from('organizations').delete().eq('id', testOrg.id)
    }
  })

  beforeEach(async () => {
    // Only clean up feedback for test user to avoid conflicts with parallel tests
    if (testUser?.id) {
      await testDb.from('feedback').delete().eq('submitted_by', testUser.id)
    }
  })

  describe('Feedback creation', () => {
    it('creates feedback with all required fields', async () => {
      const { data, error } = await testDb
        .from('feedback')
        .insert({
          title: 'Test Bug Report',
          description: 'Something is broken',
          category: 'bug',
          submitted_by: testUser.id,
          organization_id: testOrg.id,
          page_url: 'https://app.selo.io/dashboard',
          user_agent: 'Mozilla/5.0 Test Browser',
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toMatchObject({
        title: 'Test Bug Report',
        description: 'Something is broken',
        category: 'bug',
        status: 'new',
        priority: null,
        submitted_by: testUser.id,
        organization_id: testOrg.id,
      })
    })

    it('sets default status to new', async () => {
      const { data } = await testDb
        .from('feedback')
        .insert({
          title: 'Default Status Test',
          description: 'Test',
          category: 'feature_request',
          submitted_by: testUser.id,
        })
        .select()
        .single()

      expect(data?.status).toBe('new')
    })

    it('validates category enum', async () => {
      const { error } = await testDb.from('feedback').insert({
        title: 'Invalid Category',
        description: 'Test',
        category: 'invalid_category' as never,
        submitted_by: testUser.id,
      })

      expect(error).not.toBeNull()
    })
  })

  describe('Feedback updates', () => {
    it('updates status and sets updated_at', async () => {
      const { data: created } = await testDb
        .from('feedback')
        .insert({
          title: 'Status Update Test',
          description: 'Test',
          category: 'bug',
          submitted_by: testUser.id,
        })
        .select()
        .single()

      const { data: updated, error } = await testDb
        .from('feedback')
        .update({
          status: 'in_progress',
          priority: 'high',
          status_note: 'Working on this now',
        })
        .eq('id', created?.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(updated?.status).toBe('in_progress')
      expect(updated?.priority).toBe('high')
      expect(updated?.status_note).toBe('Working on this now')
    })
  })

  describe('Feedback queries', () => {
    it('orders by created_at descending', async () => {
      // Create feedback with slight delays
      await testDb.from('feedback').insert({
        title: 'First',
        description: 'Test',
        category: 'bug',
        submitted_by: testUser.id,
      })
      await testDb.from('feedback').insert({
        title: 'Second',
        description: 'Test',
        category: 'bug',
        submitted_by: testUser.id,
      })
      await testDb.from('feedback').insert({
        title: 'Third',
        description: 'Test',
        category: 'bug',
        submitted_by: testUser.id,
      })

      const { data } = await testDb
        .from('feedback')
        .select('title')
        .eq('submitted_by', testUser.id)
        .order('created_at', { ascending: false })

      expect(data?.[0].title).toBe('Third')
    })

    it('filters by status', async () => {
      await testDb.from('feedback').insert([
        {
          title: 'New One',
          description: 'Test',
          category: 'bug',
          submitted_by: testUser.id,
          status: 'new',
        },
        {
          title: 'In Progress',
          description: 'Test',
          category: 'bug',
          submitted_by: testUser.id,
          status: 'in_progress',
        },
      ])

      const { data } = await testDb
        .from('feedback')
        .select('title')
        .eq('submitted_by', testUser.id)
        .eq('status', 'in_progress')

      expect(data).toHaveLength(1)
      expect(data?.[0].title).toBe('In Progress')
    })
  })
})
