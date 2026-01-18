import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { encryptCredentials } from '../lib/utils/crypto'

const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN
const LINKEDIN_REFRESH_TOKEN = process.env.LINKEDIN_REFRESH_TOKEN

if (!LINKEDIN_ACCESS_TOKEN) {
  console.error('Missing LINKEDIN_ACCESS_TOKEN in environment')
  process.exit(1)
}

if (!process.env.CREDENTIALS_ENCRYPTION_KEY) {
  console.error('Missing CREDENTIALS_ENCRYPTION_KEY in environment')
  process.exit(1)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fetchOrganizations() {
  console.log('Fetching LinkedIn organizations...\n')

  const response = await fetch(
    'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR',
    {
      headers: {
        Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    }
  )

  if (!response.ok) {
    const text = await response.text()
    console.error('Failed to fetch organizations:', response.status, text)
    process.exit(1)
  }

  const data = await response.json()
  return data.elements || []
}

async function getOrganizationDetails(orgUrn: string) {
  const response = await fetch(
    `https://api.linkedin.com/v2/organizations/${orgUrn.split(':').pop()}`,
    {
      headers: {
        Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    }
  )

  if (!response.ok) {
    return null
  }

  return response.json()
}

async function setupLinkedIn(organizationId: string, userEmail: string) {
  // Get user and their organization
  const { data: users } = await supabase.auth.admin.listUsers()
  const authUser = users.users.find((u) => u.email === userEmail)

  if (!authUser) {
    console.error(`User ${userEmail} not found`)
    process.exit(1)
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', authUser.id)
    .single()

  if (!userRecord) {
    console.error('User has no organization')
    process.exit(1)
  }

  // Encrypt and store the LinkedIn connection
  const encryptedCredentials = encryptCredentials({
    access_token: LINKEDIN_ACCESS_TOKEN,
    refresh_token: LINKEDIN_REFRESH_TOKEN,
    organization_id: organizationId,
  })

  const { error } = await supabase.from('platform_connections').upsert(
    {
      organization_id: userRecord.organization_id,
      platform_type: 'linkedin',
      credentials: { encrypted: encryptedCredentials },
    },
    { onConflict: 'organization_id,platform_type' }
  )

  if (error) {
    console.error('Failed to save connection:', error)
    process.exit(1)
  }

  console.log('\n✅ LinkedIn connection saved successfully!')
  console.log(`   Organization ID: ${organizationId}`)
  console.log(`   Linked to: ${userEmail}`)
}

async function main() {
  const args = process.argv.slice(2)
  const userEmail = args.find((a) => a.includes('@'))
  const providedOrgId = args.find((a) => /^\d+$/.test(a))

  if (providedOrgId && userEmail) {
    // Direct setup with provided org ID
    await setupLinkedIn(providedOrgId, userEmail)
    return
  }

  // Fetch and list organizations
  const orgs = await fetchOrganizations()

  if (orgs.length === 0) {
    console.log('No organizations found. Make sure your token has r_organization_admin scope.')
    process.exit(1)
  }

  console.log('Found organizations you admin:\n')

  for (const org of orgs) {
    const orgId = org.organization?.split(':').pop()
    const details = await getOrganizationDetails(org.organization)
    const name = details?.localizedName || 'Unknown'
    console.log(`  ID: ${orgId}`)
    console.log(`  Name: ${name}`)
    console.log('')
  }

  console.log('To set up LinkedIn integration, run:')
  console.log('  npx tsx scripts/setup-linkedin.ts <org_id> <your_email>')
}

main().catch(console.error)
