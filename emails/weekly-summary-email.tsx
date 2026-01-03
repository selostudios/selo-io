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
          <Container className="mx-auto py-12 px-4">
            <Heading className="text-2xl font-bold text-neutral-900 mb-2">
              Weekly Marketing Summary
            </Heading>
            <Text className="text-neutral-600 mb-6">
              {organizationName} • Week of {weekStartDate}
            </Text>

            <Section className="bg-white p-6 rounded-lg mb-6">
              {summaryBullets.map((bullet, index) => (
                <Text key={index} className="text-neutral-800 mb-2">
                  • {bullet}
                </Text>
              ))}
            </Section>

            <Section className="mb-6">
              <Button
                href={dashboardLink}
                className="bg-neutral-900 text-white px-6 py-3 rounded-md font-medium"
              >
                View Full Dashboard
              </Button>
            </Section>

            <Text className="text-sm text-neutral-500">
              This summary is automatically generated every Monday morning based
              on your campaign performance.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
