import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  testDb,
  createTestUser,
  createTestOrganization,
  linkUserToOrganization,
} from '../helpers/db'

/**
 * Integration tests for invite-only authentication.
 *
 * These tests run against a real Supabase instance and verify:
 * - Unique constraint on invites.email
 * - Invite upsert behavior (extending expiry)
 * - Invite status transitions
 */

describe('Invites - Database Integration', () => {
  let adminUser: { id: string }
  let testOrg: { id: string }
  let testId: string

  beforeAll(async () => {
    // Use unique identifiers to avoid conflicts with parallel tests
    testId = `invites-${Date.now()}`

    // Create admin user and organization
    adminUser = await createTestUser(`admin-${testId}@test.com`, 'password123', {
      first_name: 'Admin',
      last_name: 'User',
    })
    testOrg = await createTestOrganization(`Test Org ${testId}`)
    await linkUserToOrganization(adminUser.id, testOrg.id, 'admin', 'Admin', 'User')
  })

  afterAll(async () => {
    // Clean up only data created by this test
    if (testOrg?.id) {
      await testDb.from('invites').delete().eq('organization_id', testOrg.id)
    }
    if (adminUser?.id) {
      await testDb.from('users').delete().eq('id', adminUser.id)
      await testDb.auth.admin.deleteUser(adminUser.id).catch(() => {})
    }
    if (testOrg?.id) {
      await testDb.from('organizations').delete().eq('id', testOrg.id)
    }
  })

  beforeEach(async () => {
    // Clean up only invites for this test's organization
    if (testOrg?.id) {
      await testDb.from('invites').delete().eq('organization_id', testOrg.id)
    }
  })

  describe('Unique email constraint', () => {
    it('allows creating an invite for a new email', async () => {
      const { data, error } = await testDb
        .from('invites')
        .insert({
          email: 'newuser@test.com',
          organization_id: testOrg.id,
          role: 'team_member',
          invited_by: adminUser.id,
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.email).toBe('newuser@test.com')
    })

    it('rejects duplicate email on insert', async () => {
      // Create first invite
      await testDb.from('invites').insert({
        email: 'duplicate@test.com',
        organization_id: testOrg.id,
        role: 'team_member',
        invited_by: adminUser.id,
      })

      // Try to create second invite with same email
      const { error } = await testDb.from('invites').insert({
        email: 'duplicate@test.com',
        organization_id: testOrg.id,
        role: 'admin',
        invited_by: adminUser.id,
      })

      expect(error).not.toBeNull()
      expect(error?.code).toBe('23505') // Unique violation
    })
  })

  describe('Invite upsert behavior', () => {
    it('extends expiry when upserting existing invite', async () => {
      // Create initial invite with short expiry
      const initialExpiry = new Date()
      initialExpiry.setDate(initialExpiry.getDate() + 1) // 1 day

      await testDb.from('invites').insert({
        email: 'upsert@test.com',
        organization_id: testOrg.id,
        role: 'team_member',
        invited_by: adminUser.id,
        expires_at: initialExpiry.toISOString(),
      })

      // Upsert with new expiry
      const newExpiry = new Date()
      newExpiry.setDate(newExpiry.getDate() + 7) // 7 days

      const { data, error } = await testDb
        .from('invites')
        .upsert(
          {
            email: 'upsert@test.com',
            organization_id: testOrg.id,
            role: 'admin', // Can also update role
            invited_by: adminUser.id,
            status: 'pending',
            expires_at: newExpiry.toISOString(),
          },
          { onConflict: 'email' }
        )
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.role).toBe('admin')
      expect(new Date(data?.expires_at)).toBeInstanceOf(Date)
      // New expiry should be ~7 days from now
      const daysDiff = (new Date(data?.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      expect(daysDiff).toBeGreaterThan(6)
      expect(daysDiff).toBeLessThan(8)
    })
  })

  describe('Invite status transitions', () => {
    it('marks invite as accepted with timestamp', async () => {
      // Create invite
      const { data: invite } = await testDb
        .from('invites')
        .insert({
          email: 'accept@test.com',
          organization_id: testOrg.id,
          role: 'team_member',
          invited_by: adminUser.id,
        })
        .select()
        .single()

      // Accept the invite
      const acceptedAt = new Date().toISOString()
      const { data, error } = await testDb
        .from('invites')
        .update({
          status: 'accepted',
          accepted_at: acceptedAt,
        })
        .eq('id', invite?.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.status).toBe('accepted')
      expect(data?.accepted_at).not.toBeNull()
    })

    it('can query pending invites by email', async () => {
      // Create pending invite
      await testDb.from('invites').insert({
        email: 'pending@test.com',
        organization_id: testOrg.id,
        role: 'team_member',
        invited_by: adminUser.id,
        status: 'pending',
      })

      // Query for pending invite
      const { data, error } = await testDb
        .from('invites')
        .select('*')
        .eq('email', 'pending@test.com')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single()

      expect(error).toBeNull()
      expect(data?.email).toBe('pending@test.com')
      expect(data?.status).toBe('pending')
    })

    it('does not return expired invites in pending query', async () => {
      // Create expired invite
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 1)

      await testDb.from('invites').insert({
        email: 'expired@test.com',
        organization_id: testOrg.id,
        role: 'team_member',
        invited_by: adminUser.id,
        status: 'pending',
        expires_at: expiredDate.toISOString(),
      })

      // Query for pending invite (should not find it)
      const { data } = await testDb
        .from('invites')
        .select('*')
        .eq('email', 'expired@test.com')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single()

      expect(data).toBeNull()
    })
  })
})
