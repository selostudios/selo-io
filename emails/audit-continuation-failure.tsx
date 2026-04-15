import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
} from '@react-email/components'

interface AuditContinuationFailureEmailProps {
  auditUrl: string
  auditReviewLink: string
  auditId: string
  organizationName: string | null
  pagesCrawled: number
  currentBatch: number
  attempts: number
  reason: string
  detectedAt: string
}

export default function AuditContinuationFailureEmail({
  auditUrl = 'https://example.com',
  auditReviewLink = 'https://app.selo.io/seo/audit/00000000-0000-0000-0000-000000000000',
  auditId = '00000000-0000-0000-0000-000000000000',
  organizationName = 'Naturna Institute',
  pagesCrawled = 412,
  currentBatch = 11,
  attempts = 3,
  reason = 'fetch timeout (AbortError)',
  detectedAt = '2026-04-15T13:00:00Z',
}: AuditContinuationFailureEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Audit continuation failed for {auditUrl}</Preview>
      <Tailwind>
        <Body className="bg-neutral-50 font-sans">
          <Container className="mx-auto max-w-xl bg-white p-8">
            <Heading className="text-xl font-semibold text-neutral-900">
              Audit continuation failed
            </Heading>

            <Section className="mt-4">
              <Text className="text-sm text-neutral-700">
                The self-continuation chain for an audit failed after {attempts} retry attempts. The
                audit has been left in <code>batch_complete</code> state and will be picked up by
                the next audit-resume cron run, but operator review is recommended in case the
                failure is persistent.
              </Text>
            </Section>

            <Section className="mt-4 rounded-lg bg-neutral-50 p-4">
              <Text className="my-1 text-sm font-medium text-neutral-900">
                Organization: {organizationName ?? '(one-time audit, no organization)'}
              </Text>
              <Text className="my-1 text-sm text-neutral-700">Site: {auditUrl}</Text>
              <Text className="my-1 text-sm text-neutral-700">Audit ID: {auditId}</Text>
              <Text className="my-1 text-sm text-neutral-700">
                Progress: {pagesCrawled} pages crawled (batch {currentBatch})
              </Text>
              <Text className="my-1 text-sm text-neutral-700">Detected at: {detectedAt}</Text>
            </Section>

            <Section className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4">
              <Text className="my-1 text-xs font-medium tracking-wide text-red-700 uppercase">
                Error reason
              </Text>
              <Text className="my-1 font-mono text-sm break-words text-red-900">{reason}</Text>
            </Section>

            <Section className="mt-6 text-center">
              <Button
                href={auditReviewLink}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
              >
                Review audit
              </Button>
            </Section>

            <Hr className="my-6 border-neutral-200" />

            <Section>
              <Text className="text-xs text-neutral-500">
                Likely causes: Vercel cold-start exceeding the per-attempt timeout, a deployment
                mid-audit invalidating the running function, transient network issues between
                function invocations, or a downstream service (Supabase, PageSpeed) being
                unavailable.
              </Text>
              <Text className="text-xs text-neutral-400">
                This alert is sent automatically when all retries of the audit continuation trigger
                have failed. Audits are retried every 10 minutes via the audit-resume cron.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
