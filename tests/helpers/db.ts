import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const testDb = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})

export async function createTestUser(
  email: string,
  password: string,
  metadata?: { first_name?: string; last_name?: string }
) {
  const { data, error } = await testDb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  })
  if (error) throw error
  return data.user
}

export async function createTestOrganization(name: string, industryId?: string) {
  const { data, error } = await testDb
    .from('organizations')
    .insert({
      name,
      industry: industryId,
      primary_color: '#000000',
      secondary_color: '#F5F5F0',
      accent_color: '#666666',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function linkUserToOrganization(
  userId: string,
  organizationId: string,
  role: 'admin' | 'team_member' | 'client_viewer',
  firstName?: string,
  lastName?: string
) {
  const { data, error } = await testDb
    .from('users')
    .insert({
      id: userId,
      organization_id: organizationId,
      role,
      first_name: firstName,
      last_name: lastName,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function cleanupTestData() {
  // Clean up in reverse order of dependencies
  await testDb.from('campaigns').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await testDb.from('invites').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await testDb.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await testDb.from('organizations').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  // Delete auth users
  const { data: users } = await testDb.auth.admin.listUsers()
  for (const user of users.users) {
    await testDb.auth.admin.deleteUser(user.id)
  }
}
