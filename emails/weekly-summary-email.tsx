import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
} from '@react-email/components'

interface WeeklySummaryEmailProps {
  organizationName: string
  weekStartDate: string
  summaryBullets: string[]
  dashboardLink: string
}

export default function WeeklySummaryEmail({
  organizationName,
  weekStartDate,
  summaryBullets,
  dashboardLink,
}: WeeklySummaryEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Weekly Marketing Summary for {organizationName}</Preview>
      <Tailwind>
        <Body className="bg-neutral-50 font-sans">
          <Container className="mx-auto px-4 py-12">
            <Heading className="mb-2 text-2xl font-bold text-neutral-900">
              Weekly Marketing Summary
            </Heading>
            <Text className="mb-6 text-neutral-600">
              {organizationName} • Week of {weekStartDate}
            </Text>

            <Section className="mb-6 rounded-lg bg-white p-6">
              {summaryBullets.map((bullet, index) => (
                <Text key={index} className="mb-2 text-neutral-800">
                  • {bullet}
                </Text>
              ))}
            </Section>

            <Section className="mb-6">
              <Button
                href={dashboardLink}
                className="rounded-md bg-neutral-900 px-6 py-3 font-medium text-white"
              >
                View Full Dashboard
              </Button>
            </Section>

            <Text className="text-sm text-neutral-500">
              This summary is automatically generated every Monday morning based on your campaign
              performance.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
