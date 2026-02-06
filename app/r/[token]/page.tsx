import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ token: string }>
}

/**
 * Backward compatibility: redirect /r/[token] to /s/[token]
 * Report share links previously used /r/ but now use the generic /s/ route
 */
export default async function LegacyReportSharePage({ params }: PageProps) {
  const { token } = await params
  redirect(`/s/${token}`)
}
