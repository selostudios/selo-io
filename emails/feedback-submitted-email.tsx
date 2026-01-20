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

import { CATEGORY_LABELS, FeedbackCategory } from '@/lib/types/feedback'

interface FeedbackSubmittedEmailProps {
  feedbackId: string
  title: string
  description: string
  category: FeedbackCategory
  submitterEmail: string
  supportUrl: string
}

export default function FeedbackSubmittedEmail({
  feedbackId,
  title,
  description,
  category,
  submitterEmail,
  supportUrl,
}: FeedbackSubmittedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>New issue reported: {title}</Preview>
      <Tailwind>
        <Body className="bg-neutral-50 font-sans">
          <Container className="mx-auto px-4 py-12">
            {/* Header */}
            <Section className="mb-6">
              <Text className="m-0 text-xl font-bold text-neutral-900">Selo IO</Text>
            </Section>
            <Heading className="mb-4 text-2xl font-bold text-neutral-900">
              New Issue Reported
            </Heading>
            {/* Category Badge */}
            <Section className="mb-4">
              <Text className="m-0 inline-block rounded-md bg-neutral-200 px-2 py-1 text-sm font-medium text-neutral-700">
                {CATEGORY_LABELS[category]}
              </Text>
            </Section>
            {/* Title */}
            <Text className="mb-2 text-lg font-bold text-neutral-900">{title}</Text>
            {/* Description */}
            <Text className="mb-4 text-neutral-700">{description}</Text>
            {/* Submitter */}
            <Text className="mb-6 text-neutral-600">Submitted by: {submitterEmail}</Text>
            {/* Button */}
            <Section className="mb-6">
              <Button
                href={supportUrl}
                className="rounded-md bg-neutral-900 px-6 py-3 font-medium text-white"
              >
                View in Support
              </Button>
            </Section>
            <Text className="text-sm text-neutral-500">Feedback ID: {feedbackId}</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
