import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  testDb,
  createTestUser,
  createTestOrganization,
  linkUserToOrganization,
} from '../../helpers/db'

/**
 * Integration coverage for RLS on `marketing_review_style_memo_versions`.
 *
 * The migration defines two policies:
 *   - SELECT: any team_member of the org (or internal user) can read rows
 *   - INSERT: only admin team_members (or internal users) can write rows
 *
 * These tests exercise real auth'd PostgREST clients (anon + authed) against
 * a running local Supabase, rather than relying on service-role bypass. The
 * service role is used only for seed + teardown.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/** Fresh anon client — no session, simulates unauthenticated PostgREST. */
function createAnonClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  })
}

/**
 * Signs a test user in against the local GoTrue and returns a PostgREST
 * client scoped to that user's JWT. RLS is evaluated against `auth.uid()`
 * on this client, just like in production.
 */
async function createUserClient(email: string, password: string) {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  if (!data.session) throw new Error('No session returned for user sign-in')
  return client
}

describe('marketing_review_style_memo_versions RLS', () => {
  const testId = `memo-rls-${Date.now()}`
  const password = 'TestPassword123!'

  const adminEmail = `admin-${testId}@test.com`
  const teamMemberEmail = `member-${testId}@test.com`
  const otherOrgAdminEmail = `other-admin-${testId}@test.com`

  let adminUser: { id: string }
  let teamMemberUser: { id: string }
  let otherOrgAdmin: { id: string }

  let orgA: { id: string }
  let orgB: { id: string }

  let orgAVersionId: string
  let orgBVersionId: string

  beforeAll(async () => {
    // --- Users ---
    adminUser = await createTestUser(adminEmail, password, {
      first_name: 'Memo',
      last_name: 'Admin',
    })
    teamMemberUser = await createTestUser(teamMemberEmail, password, {
      first_name: 'Memo',
      last_name: 'Member',
    })
    otherOrgAdmin = await createTestUser(otherOrgAdminEmail, password, {
      first_name: 'Other',
      last_name: 'Admin',
    })

    // --- Orgs ---
    orgA = await createTestOrganization(`Memo RLS Org A ${testId}`)
    orgB = await createTestOrganization(`Memo RLS Org B ${testId}`)

    await linkUserToOrganization(adminUser.id, orgA.id, 'admin', 'Memo', 'Admin')
    await linkUserToOrganization(teamMemberUser.id, orgA.id, 'team_member', 'Memo', 'Member')
    await linkUserToOrganization(otherOrgAdmin.id, orgB.id, 'admin', 'Other', 'Admin')

    // --- Seed memo versions via service role (one per org) ---
    const { data: versionA, error: versionAError } = await testDb
      .from('marketing_review_style_memo_versions')
      .insert({
        organization_id: orgA.id,
        memo: 'Org A memo v1: prefer punchy bullets.',
        rationale: 'Author consistently trimmed adjectives and tightened verbs.',
        source: 'auto',
        snapshot_id: null,
        created_by: adminUser.id,
      })
      .select('id')
      .single()
    if (versionAError) throw versionAError
    orgAVersionId = versionA!.id

    const { data: versionB, error: versionBError } = await testDb
      .from('marketing_review_style_memo_versions')
      .insert({
        organization_id: orgB.id,
        memo: 'Org B memo v1: lead with financial impact.',
        rationale: 'Author rewrote every paragraph to open with a number.',
        source: 'auto',
        snapshot_id: null,
        created_by: otherOrgAdmin.id,
      })
      .select('id')
      .single()
    if (versionBError) throw versionBError
    orgBVersionId = versionB!.id
  })

  afterAll(async () => {
    try {
      await testDb
        .from('marketing_review_style_memo_versions')
        .delete()
        .in('organization_id', [orgA?.id, orgB?.id].filter(Boolean))

      await testDb
        .from('team_members')
        .delete()
        .in('user_id', [adminUser?.id, teamMemberUser?.id, otherOrgAdmin?.id].filter(Boolean))

      await testDb
        .from('users')
        .delete()
        .in('id', [adminUser?.id, teamMemberUser?.id, otherOrgAdmin?.id].filter(Boolean))

      for (const user of [adminUser, teamMemberUser, otherOrgAdmin]) {
        if (user?.id) {
          await testDb.auth.admin.deleteUser(user.id).catch(() => {})
        }
      }

      await testDb.from('organizations').delete().in('id', [orgA?.id, orgB?.id].filter(Boolean))
    } catch (error) {
      console.error('Cleanup error:', error)
    }
  })

  it('returns zero rows to anon clients regardless of seeded data', async () => {
    const anon = createAnonClient()

    const { data, error } = await anon.from('marketing_review_style_memo_versions').select('id')

    // RLS on SELECT filters silently for anon: no error, empty result set.
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('isolates org A members from seeing org B memo versions', async () => {
    const memberClient = await createUserClient(teamMemberEmail, password)

    const { data, error } = await memberClient
      .from('marketing_review_style_memo_versions')
      .select('id, organization_id')

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    const orgIds = new Set((data ?? []).map((r) => r.organization_id))
    expect(orgIds.has(orgA.id)).toBe(true)
    expect(orgIds.has(orgB.id)).toBe(false)

    // Sanity: the seeded org A version should be visible to its members.
    expect((data ?? []).some((r) => r.id === orgAVersionId)).toBe(true)
    expect((data ?? []).some((r) => r.id === orgBVersionId)).toBe(false)
  })

  it('blocks non-admin team members from inserting new memo versions', async () => {
    const memberClient = await createUserClient(teamMemberEmail, password)

    const { data, error } = await memberClient
      .from('marketing_review_style_memo_versions')
      .insert({
        organization_id: orgA.id,
        memo: 'Illegitimate memo from a team_member.',
        rationale: 'Should be blocked.',
        source: 'manual',
        snapshot_id: null,
      })
      .select('id')
      .single()

    // PostgREST surfaces RLS INSERT denials as errors (code 42501).
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error!.code).toBe('42501')
  })

  it('allows org admins to insert memo versions for their own org', async () => {
    const adminClient = await createUserClient(adminEmail, password)

    const { data, error } = await adminClient
      .from('marketing_review_style_memo_versions')
      .insert({
        organization_id: orgA.id,
        memo: 'Admin-authored manual edit.',
        rationale: null,
        source: 'manual',
        snapshot_id: null,
      })
      .select('id, organization_id, source')
      .single()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.organization_id).toBe(orgA.id)
    expect(data!.source).toBe('manual')
  })

  it('blocks org admins from inserting versions into a different org', async () => {
    const adminClient = await createUserClient(adminEmail, password)

    const { data, error } = await adminClient
      .from('marketing_review_style_memo_versions')
      .insert({
        organization_id: orgB.id,
        memo: 'Cross-org insertion attempt.',
        rationale: null,
        source: 'manual',
        snapshot_id: null,
      })
      .select('id')
      .single()

    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error!.code).toBe('42501')
  })
})
