import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
} from '@react-email/components'

interface AIVisibilityBudgetAlertProps {
  orgName: string
  alertType: 'approaching' | 'exceeded'
  currentSpendCents: number
  budgetCents: number
  thresholdPercent: number
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export default function AIVisibilityBudgetAlert({
  orgName = 'Acme Corp',
  alertType = 'approaching',
  currentSpendCents = 9000,
  budgetCents = 10000,
  thresholdPercent = 90,
}: AIVisibilityBudgetAlertProps) {
  const isExceeded = alertType === 'exceeded'
  const spendPercent = Math.round((currentSpendCents / budgetCents) * 100)

  const previewText = isExceeded
    ? `AI Visibility budget exceeded for ${orgName}`
    : `AI Visibility budget at ${spendPercent}% for ${orgName}`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-neutral-50 font-sans">
          <Container className="mx-auto max-w-xl bg-white p-8">
            <Heading className="text-xl font-semibold text-neutral-900">
              {isExceeded ? 'Budget Exceeded' : 'Budget Alert'}
            </Heading>

            <Section className="mt-4">
              <Text className="text-sm text-neutral-700">
                {isExceeded
                  ? `The AI Visibility monthly budget for ${orgName} has been exceeded. Syncing has been paused until the next billing cycle.`
                  : `The AI Visibility spend for ${orgName} has reached ${spendPercent}% of the monthly budget.`}
              </Text>
            </Section>

            <Section className="mt-4 rounded-lg bg-neutral-50 p-4">
              <Text className="text-sm font-medium text-neutral-900">
                Current spend: {formatCents(currentSpendCents)} / {formatCents(budgetCents)}
              </Text>
              <Text className="text-sm text-neutral-600">Alert threshold: {thresholdPercent}%</Text>
            </Section>

            {isExceeded && (
              <Section className="mt-4">
                <Text className="text-sm text-neutral-600">
                  To resume syncing, increase the monthly budget in the AI Visibility settings for
                  this organization.
                </Text>
              </Section>
            )}

            <Section className="mt-6 border-t border-neutral-200 pt-4">
              <Text className="text-xs text-neutral-400">
                This is an automated alert from Selo IO.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
