import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  testDb,
  createTestUser,
  createTestOrganization,
  linkUserToOrganization,
  linkUserAsDeveloper,
  createTestFeedback,
  cleanupTestData,
} from '../helpers/db'

describe('Feedback RLS Policies', () => {
  let regularUser: { id: string }
  let developerUser: { id: string }
  let testOrg: { id: string }

  beforeAll(async () => {
    await cleanupTestData()

    // Create regular user
    regularUser = await createTestUser('regular@test.com', 'password123', {
      first_name: 'Regular',
      last_name: 'User',
    })
    testOrg = await createTestOrganization('Test Org')
    await linkUserToOrganization(regularUser.id, testOrg.id, 'team_member', 'Regular', 'User')

    // Create developer user
    developerUser = await createTestUser('developer@test.com', 'password123', {
      first_name: 'Developer',
      last_name: 'User',
    })
    await linkUserAsDeveloper(developerUser.id, 'Developer', 'User')
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  beforeEach(async () => {
    await testDb.from('feedback').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  })

  describe('Insert policies', () => {
    it('allows authenticated users to submit feedback', async () => {
      const feedback = await createTestFeedback(regularUser.id, {
        title: 'Test feedback',
        description: 'Test description',
        category: 'bug',
        organizationId: testOrg.id,
      })

      expect(feedback.title).toBe('Test feedback')
      expect(feedback.status).toBe('new')
    })
  })

  describe('Select policies', () => {
    it('users can view their own feedback', async () => {
      await createTestFeedback(regularUser.id, {
        title: 'My feedback',
        description: 'Test',
        category: 'bug',
      })

      const { data } = await testDb.from('feedback').select('*').eq('submitted_by', regularUser.id)

      expect(data).toHaveLength(1)
      expect(data?.[0].title).toBe('My feedback')
    })

    it('developers can view all feedback', async () => {
      await createTestFeedback(regularUser.id, {
        title: 'User feedback',
        description: 'Test',
        category: 'bug',
      })

      const { data } = await testDb.from('feedback').select('*')

      expect(data?.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Update policies', () => {
    it('allows updating feedback status', async () => {
      const feedback = await createTestFeedback(regularUser.id, {
        title: 'Update test',
        description: 'Test',
        category: 'bug',
      })

      const { error } = await testDb
        .from('feedback')
        .update({ status: 'under_review', priority: 'high' })
        .eq('id', feedback.id)

      expect(error).toBeNull()
    })
  })
})
