import { notFound } from 'next/navigation'
import { getAuditReport } from './actions'
import { AuditReport } from '@/components/audit/audit-report'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface AuditReportPageProps {
  params: Promise<{ id: string }>
}

function LiveProgress({ status, pagesCrawled }: { status: string; pagesCrawled: number }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center py-12">
          <Loader2 className="text-primary mb-4 h-12 w-12 animate-spin" />
          <h2 className="mb-2 text-xl font-semibold">
            {status === 'pending' ? 'Starting Audit...' : 'Crawling Site...'}
          </h2>
          <p className="text-muted-foreground text-sm">
            {status === 'crawling'
              ? `${pagesCrawled} page${pagesCrawled !== 1 ? 's' : ''} crawled so far`
              : 'Preparing to analyze your website'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function AuditReportPage({ params }: AuditReportPageProps) {
  const { id } = await params
  const data = await getAuditReport(id)

  if (!data) {
    notFound()
  }

  const { audit, checks, pages } = data

  // Show progress view for in-progress audits
  if (audit.status === 'pending' || audit.status === 'crawling') {
    return <LiveProgress status={audit.status} pagesCrawled={audit.pages_crawled} />
  }

  // Show failed state
  if (audit.status === 'failed') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <div className="mb-4 rounded-full bg-red-100 p-4">
              <span className="text-3xl" aria-hidden="true">
                &#x26D4;
              </span>
            </div>
            <h2 className="mb-2 text-xl font-semibold">Audit Failed</h2>
            <p className="text-muted-foreground text-center text-sm">
              We encountered an error while auditing this website. Please try running the audit
              again.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <AuditReport audit={audit} checks={checks} pages={pages} />
}
