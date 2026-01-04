import { createClient } from '@supabase/supabase-js'
import { testUsers, testOrganization, testCampaign } from '../fixtures'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function seedTestData() {
  console.log('🌱 Seeding test data...')

  // Get Marketing industry
  const { data: industries } = await supabase.from('industries').select('id, name')

  const marketingIndustry = industries?.find((i) => i.name === 'Marketing')

  // Create admin user
  const adminUser = await supabase.auth.admin.createUser({
    email: testUsers.admin.email,
    password: testUsers.admin.password,
    email_confirm: true,
    user_metadata: {
      first_name: testUsers.admin.firstName,
      last_name: testUsers.admin.lastName,
    },
  })

  // Create team member user
  const teamMemberUser = await supabase.auth.admin.createUser({
    email: testUsers.teamMember.email,
    password: testUsers.teamMember.password,
    email_confirm: true,
    user_metadata: {
      first_name: testUsers.teamMember.firstName,
      last_name: testUsers.teamMember.lastName,
    },
  })

  // Create test organization
  const { data: org } = await supabase
    .from('organizations')
    .insert({
      name: testOrganization.name,
      industry: marketingIndustry?.id,
      primary_color: testOrganization.primaryColor,
      secondary_color: testOrganization.secondaryColor,
      accent_color: testOrganization.accentColor,
    })
    .select()
    .single()

  // Link users to organization
  await supabase.from('users').insert([
    {
      id: adminUser.data.user!.id,
      organization_id: org!.id,
      role: 'admin',
      first_name: testUsers.admin.firstName,
      last_name: testUsers.admin.lastName,
    },
    {
      id: teamMemberUser.data.user!.id,
      organization_id: org!.id,
      role: 'team_member',
      first_name: testUsers.teamMember.firstName,
      last_name: testUsers.teamMember.lastName,
    },
  ])

  // Create test campaign
  await supabase.from('campaigns').insert({
    name: testCampaign.name,
    description: testCampaign.description,
    organization_id: org!.id,
    start_date: testCampaign.startDate,
    end_date: testCampaign.endDate,
  })

  console.log('✅ Test data seeded successfully')
}

export async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...')

  // Clean up in reverse order
  await supabase.from('campaigns').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('invites').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('organizations').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  // Delete auth users
  const { data: users } = await supabase.auth.admin.listUsers()
  for (const user of users.users) {
    await supabase.auth.admin.deleteUser(user.id)
  }

  console.log('✅ Test data cleaned up')
}

// Run if called directly
if (require.main === module) {
  seedTestData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Seed failed:', error)
      process.exit(1)
    })
}
