import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
} from '@react-email/components'
import { UserRole } from '@/lib/enums'

function getRoleDescription(role: string): string {
  switch (role) {
    case UserRole.ExternalDeveloper:
      return 'Selo IO gives you access to run SEO site audits, PageSpeed audits, AI readiness checks, and generate combined reports for your clients.'
    default:
      return 'Selo IO helps marketing teams track campaign performance across HubSpot, Google Analytics, LinkedIn, and more.'
  }
}

interface InviteEmailProps {
  inviteLink: string
  organizationName: string
  invitedByEmail: string
  role: string
  logoUrl?: string | null
}

export default function InviteEmail({
  inviteLink,
  organizationName,
  invitedByEmail,
  role,
  logoUrl,
}: InviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>You&apos;ve been invited to join {organizationName} on Selo IO</Preview>
      <Tailwind>
        <Body className="bg-neutral-50 font-sans">
          <Container className="mx-auto px-4 py-12">
            {/* Logo + Org Name Header */}
            <Section className="mb-6">
              <table cellPadding="0" cellSpacing="0" style={{ width: 'auto' }}>
                <tr>
                  {logoUrl && (
                    <td style={{ paddingRight: '12px', verticalAlign: 'middle' }}>
                      <Img
                        src={logoUrl}
                        alt={organizationName}
                        width="40"
                        height="40"
                        style={{ borderRadius: '8px', objectFit: 'contain' }}
                      />
                    </td>
                  )}
                  <td style={{ verticalAlign: 'middle' }}>
                    <Text className="m-0 text-xl font-bold text-neutral-900">
                      {organizationName}
                    </Text>
                  </td>
                </tr>
              </table>
            </Section>
            <Heading className="mb-4 text-2xl font-bold text-neutral-900">
              Join {organizationName}
            </Heading>
            <Text className="mb-4 text-neutral-700">
              {invitedByEmail} has invited you to join {organizationName} on Selo IO as a{' '}
              <strong>{role.replace('_', ' ')}</strong>.
            </Text>
            <Text className="mb-6 text-neutral-700">{getRoleDescription(role)}</Text>
            <Section className="mb-6">
              <Button
                href={inviteLink}
                className="rounded-md bg-neutral-900 px-6 py-3 font-medium text-white"
              >
                Accept Invitation
              </Button>
            </Section>
            <Text className="text-sm text-neutral-500">
              This invitation will expire in 7 days. If you didn&apos;t expect this invitation, you
              can safely ignore this email.
            </Text>
            <Text className="mt-4 text-sm text-neutral-500">
              Or copy and paste this link:{' '}
              <Link href={inviteLink} className="text-blue-600">
                {inviteLink}
              </Link>
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
