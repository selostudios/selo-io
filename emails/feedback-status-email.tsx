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

import { FeedbackStatus, STATUS_LABELS } from '@/lib/types/feedback'

interface FeedbackStatusEmailProps {
  title: string
  oldStatus: FeedbackStatus
  newStatus: FeedbackStatus
  note: string | null
}

export default function FeedbackStatusEmail({
  title,
  oldStatus,
  newStatus,
  note,
}: FeedbackStatusEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your issue has been updated: {title}</Preview>
      <Tailwind>
        <Body className="bg-neutral-50 font-sans">
          <Container className="mx-auto px-4 py-12">
            {/* Header */}
            <Section className="mb-6">
              <Text className="m-0 text-xl font-bold text-neutral-900">Selo IO</Text>
            </Section>
            <Heading className="mb-4 text-2xl font-bold text-neutral-900">
              Issue Status Updated
            </Heading>
            {/* Title */}
            <Text className="mb-4 text-lg font-bold text-neutral-900">{title}</Text>
            {/* Status Change Box */}
            <Section className="mb-6 rounded-md bg-neutral-100 p-4">
              <Text className="m-0 text-neutral-700">
                {STATUS_LABELS[oldStatus]} → {STATUS_LABELS[newStatus]}
              </Text>
            </Section>
            {/* Note from developer */}
            {note && (
              <Section className="mb-6">
                <Text className="mb-2 font-medium text-neutral-900">Note from developer:</Text>
                <Text className="m-0 text-neutral-700">{note}</Text>
              </Section>
            )}
            {/* Thank you message */}
            <Text className="text-neutral-600">
              Thank you for helping us improve Selo IO. We appreciate your feedback.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
