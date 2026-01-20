import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { AuditPDF } from '@/lib/audit/pdf'
import type { DismissedCheck, SiteAuditCheck, SiteAuditPage } from '@/lib/audit/types'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()

  // Get user and verify access
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch audit
  const { data: audit, error: auditError } = await supabase
    .from('site_audits')
    .select('*')
    .eq('id', id)
    .single()

  if (auditError || !audit) {
    console.error('[PDF Export Error]', {
      type: 'audit_not_found',
      auditId: id,
      error: auditError?.message,
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Fetch checks
  const { data: checks, error: checksError } = await supabase
    .from('site_audit_checks')
    .select('*')
    .eq('audit_id', id)

  if (checksError) {
    console.error('[PDF Export Error]', {
      type: 'checks_fetch_failed',
      auditId: id,
      error: checksError.message,
      timestamp: new Date().toISOString(),
    })
  }

  // Fetch pages for URL lookup
  const { data: pages } = await supabase.from('site_audit_pages').select('*').eq('audit_id', id)

  // Fetch dismissed checks for this organization
  const { data: dismissedChecks } = await supabase
    .from('dismissed_checks')
    .select('*')
    .eq('organization_id', audit.organization_id)

  // Filter out dismissed checks
  const pageMap = new Map<string, SiteAuditPage>((pages || []).map((p: SiteAuditPage) => [p.id, p]))
  const dismissedList: DismissedCheck[] = dismissedChecks || []

  const visibleChecks = (checks || []).filter((check: SiteAuditCheck) => {
    const pageUrl = check.page_id ? pageMap.get(check.page_id)?.url : audit.url
    return !dismissedList.some((d) => d.check_name === check.check_name && d.url === pageUrl)
  })

  try {
    // Generate PDF with only non-dismissed checks
    const pdfBuffer = await renderToBuffer(<AuditPDF audit={audit} checks={visibleChecks} />)

    // Generate filename from URL
    const sanitizedUrl = audit.url
      .replace(/^https?:\/\//, '')
      .replace(/[^a-z0-9]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `audit-${sanitizedUrl}-${dateStr}.pdf`

    // Return PDF with proper headers (convert Buffer to Uint8Array for Next.js Response)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('[PDF Export Error]', {
      type: 'pdf_generation_failed',
      auditId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
