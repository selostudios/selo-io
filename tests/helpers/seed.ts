import { createClient } from '@supabase/supabase-js'
import { testUsers, testOrganization, testCampaign, testMarketingReview } from '../fixtures'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function seedTestData() {
  console.log('🌱 Seeding test data...')

  // Clean up first to ensure idempotency
  await cleanupTestData()

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

  // Create viewer user
  const viewerUser = await supabase.auth.admin.createUser({
    email: testUsers.viewer.email,
    password: testUsers.viewer.password,
    email_confirm: true,
    user_metadata: {
      first_name: testUsers.viewer.firstName,
      last_name: testUsers.viewer.lastName,
    },
  })

  // Create developer user
  const developerUser = await supabase.auth.admin.createUser({
    email: testUsers.developer.email,
    password: testUsers.developer.password,
    email_confirm: true,
    user_metadata: {
      first_name: testUsers.developer.firstName,
      last_name: testUsers.developer.lastName,
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
  // organization_id and role are legacy columns, but ~30 RLS policies still
  // reference them. Without these set, RLS blocks the team_members join in
  // getUserRecord(), causing the [orgId] layout to redirect to dashboard.
  await supabase.from('users').insert([
    {
      id: adminUser.data.user!.id,
      first_name: testUsers.admin.firstName,
      last_name: testUsers.admin.lastName,
      organization_id: org!.id,
      role: 'admin',
    },
    {
      id: teamMemberUser.data.user!.id,
      first_name: testUsers.teamMember.firstName,
      last_name: testUsers.teamMember.lastName,
      organization_id: org!.id,
      role: 'team_member',
    },
    {
      id: viewerUser.data.user!.id,
      first_name: testUsers.viewer.firstName,
      last_name: testUsers.viewer.lastName,
      organization_id: org!.id,
      role: 'client_viewer',
    },
    {
      id: developerUser.data.user!.id,
      is_internal: true,
      first_name: testUsers.developer.firstName,
      last_name: testUsers.developer.lastName,
      organization_id: org!.id,
      role: 'developer',
    },
  ])

  // Add developer to internal_employees table
  await supabase.from('internal_employees').insert({
    user_id: developerUser.data.user!.id,
  })

  // Create team memberships (primary source of truth for org + role)
  await supabase.from('team_members').insert([
    {
      user_id: adminUser.data.user!.id,
      organization_id: org!.id,
      role: 'admin',
    },
    {
      user_id: teamMemberUser.data.user!.id,
      organization_id: org!.id,
      role: 'team_member',
    },
    {
      user_id: viewerUser.data.user!.id,
      organization_id: org!.id,
      role: 'client_viewer',
    },
    {
      user_id: developerUser.data.user!.id,
      organization_id: org!.id,
      role: 'developer',
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

  // Seed a performance review + draft + published snapshot so E2E and visual
  // tests can exercise the preview/snapshot/public-share flows without having
  // to click through the "New Review" wizard (which calls external AI APIs).
  //
  // Narrative is deliberately non-empty across all six blocks so the deck
  // renders real content (not placeholder text) in screenshots.
  const { data: review } = await supabase
    .from('marketing_reviews')
    .insert({
      id: testMarketingReview.reviewId,
      organization_id: org!.id,
      quarter: testMarketingReview.quarter,
      title: testMarketingReview.title,
      created_by: adminUser.data.user!.id,
    })
    .select('id')
    .single()

  if (review) {
    await supabase.from('marketing_review_drafts').insert({
      review_id: review.id,
      data: {},
      narrative: testMarketingReview.narrative,
      ai_originals: testMarketingReview.narrative,
    })

    const { data: snapshot } = await supabase
      .from('marketing_review_snapshots')
      .insert({
        id: testMarketingReview.snapshotId,
        review_id: review.id,
        version: 1,
        published_by: adminUser.data.user!.id,
        period_start: testMarketingReview.periodStart,
        period_end: testMarketingReview.periodEnd,
        compare_qoq_start: testMarketingReview.compareQoqStart,
        compare_qoq_end: testMarketingReview.compareQoqEnd,
        compare_yoy_start: testMarketingReview.compareYoyStart,
        compare_yoy_end: testMarketingReview.compareYoyEnd,
        data: {},
        narrative: testMarketingReview.narrative,
        share_token: testMarketingReview.internalShareToken,
      })
      .select('id')
      .single()

    if (snapshot) {
      await supabase
        .from('marketing_reviews')
        .update({ latest_snapshot_id: snapshot.id })
        .eq('id', review.id)

      // Seed a public share link for the snapshot. Writing via the service
      // role bypasses RLS but still enforces CHECK constraints — this insert
      // requires the shared_links.resource_type constraint to include
      // 'marketing_review'. If it's missing the insert fails loudly here and
      // the public-share E2E tests are expected to be skipped/failing until
      // the constraint is patched.
      const shareExpiresAt = new Date()
      shareExpiresAt.setDate(shareExpiresAt.getDate() + 30)

      const { error: shareError } = await supabase.from('shared_links').insert({
        resource_type: 'marketing_review',
        resource_id: snapshot.id,
        token: testMarketingReview.publicShareToken,
        expires_at: shareExpiresAt.toISOString(),
        max_views: 1000,
        created_by: adminUser.data.user!.id,
        organization_id: org!.id,
      })

      if (shareError) {
        console.warn(
          '⚠️  Marketing review share link not seeded (likely missing marketing_review ' +
            'in shared_links.resource_type check constraint):',
          shareError.message
        )
      }
    }
  }

  console.log('✅ Test data seeded successfully')
}

export async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...')

  try {
    // Delete auth users first (this will cascade to users table via trigger)
    const { data: users } = await supabase.auth.admin.listUsers()
    for (const user of users.users) {
      await supabase.auth.admin.deleteUser(user.id)
    }

    // Clean up remaining data (in case of orphaned records)
    await supabase.from('team_members').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('campaigns').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('invites').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    // Share links cascade when their org is deleted, but the public-share
    // seed uses a stable token — ensure any prior row with that token is
    // removed before the next seed run to keep the test deterministic.
    await supabase.from('shared_links').delete().eq('token', testMarketingReview.publicShareToken)
    await supabase.from('organizations').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    console.log('✅ Test data cleaned up')
  } catch (error) {
    console.error('⚠️  Cleanup warning:', error)
    // Don't fail - cleanup may have partial success
  }
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
