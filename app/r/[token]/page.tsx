import { validateShareToken } from '@/app/(authenticated)/seo/reports/share-actions'
import { ShareErrorCode } from '@/lib/enums'
import { PublicReportClient } from './client'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function PublicReportPage({ params }: PageProps) {
  const { token } = await params

  // Validate the share token
  const validation = await validateShareToken(token)

  // Handle errors
  if (!validation.is_valid) {
    return <ErrorPage errorCode={validation.error_code} />
  }

  return (
    <PublicReportClient
      token={token}
      reportId={validation.report_id!}
      requiresPassword={validation.requires_password}
    />
  )
}

function ErrorPage({ errorCode }: { errorCode: ShareErrorCode | null }) {
  const errorMessages = {
    [ShareErrorCode.NotFound]: {
      title: 'Link Not Found',
      description: 'This report link does not exist or has been deleted.',
    },
    [ShareErrorCode.Expired]: {
      title: 'Link Expired',
      description: 'This report link has expired. Please request a new link from the report owner.',
    },
    [ShareErrorCode.ViewLimitExceeded]: {
      title: 'View Limit Reached',
      description:
        'This report link has reached its maximum number of views. Please request a new link.',
    },
    [ShareErrorCode.ReportNotFound]: {
      title: 'Report Not Found',
      description: 'The report associated with this link no longer exists.',
    },
  }

  const error = errorCode ? errorMessages[errorCode] : null
  const title = error?.title ?? 'Error'
  const description = error?.description ?? 'Unable to access this report.'

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-md px-4 text-center">
        <div className="mb-6 text-6xl">🔒</div>
        <h1 className="mb-4 text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground mb-8">{description}</p>
        <a
          href="/"
          className="inline-block rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Go Home
        </a>
      </div>
    </div>
  )
}
