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
      <Preview>You've been invited to join {organizationName} on Selo IO</Preview>
      <Tailwind>
        <Body className="bg-neutral-50 font-sans">
          <Container className="mx-auto py-12 px-4">
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
                    <Text className="text-xl font-bold text-neutral-900 m-0">
                      {organizationName}
                    </Text>
                  </td>
                </tr>
              </table>
            </Section>
            <Heading className="text-2xl font-bold text-neutral-900 mb-4">
              Join {organizationName}
            </Heading>
            <Text className="text-neutral-700 mb-4">
              {invitedByEmail} has invited you to join {organizationName} on Selo IO
              as a <strong>{role.replace('_', ' ')}</strong>.
            </Text>
            <Text className="text-neutral-700 mb-6">
              Selo IO helps marketing teams track campaign performance across
              HubSpot, Google Analytics, LinkedIn, and more.
            </Text>
            <Section className="mb-6">
              <Button
                href={inviteLink}
                className="bg-neutral-900 text-white px-6 py-3 rounded-md font-medium"
              >
                Accept Invitation
              </Button>
            </Section>
            <Text className="text-sm text-neutral-500">
              This invitation will expire in 7 days. If you didn't expect this
              invitation, you can safely ignore this email.
            </Text>
            <Text className="text-sm text-neutral-500 mt-4">
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
