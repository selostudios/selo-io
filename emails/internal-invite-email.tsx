import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
} from '@react-email/components'

interface InternalInviteEmailProps {
  inviteLink: string
  invitedByEmail: string
}

export default function InternalInviteEmail({
  inviteLink,
  invitedByEmail,
}: InternalInviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>You&apos;ve been invited to join the Selo team</Preview>
      <Tailwind>
        <Body className="bg-neutral-50 font-sans">
          <Container className="mx-auto px-4 py-12">
            <Section className="mb-6">
              <Text className="m-0 text-xl font-bold text-neutral-900">Selo</Text>
            </Section>
            <Heading className="mb-4 text-2xl font-bold text-neutral-900">
              Join the Selo Team
            </Heading>
            <Text className="mb-4 text-neutral-700">
              {invitedByEmail} has invited you to join Selo as an internal team member.
            </Text>
            <Text className="mb-6 text-neutral-700">
              As an internal team member, you&apos;ll have access to all organizations, internal
              tools, and system settings.
            </Text>
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
