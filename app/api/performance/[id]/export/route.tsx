import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { PerformancePDF } from '@/lib/performance/pdf'

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

  // Get user's organization
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Fetch audit
  const { data: audit, error: auditError } = await supabase
    .from('performance_audits')
    .select('*')
    .eq('id', id)
    .eq('organization_id', userRecord.organization_id)
    .single()

  if (auditError || !audit) {
    console.error('[Performance PDF Export Error]', {
      type: 'audit_not_found',
      auditId: id,
      error: auditError?.message,
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Fetch results
  const { data: results, error: resultsError } = await supabase
    .from('performance_audit_results')
    .select('*')
    .eq('audit_id', id)

  if (resultsError) {
    console.error('[Performance PDF Export Error]', {
      type: 'results_fetch_failed',
      auditId: id,
      error: resultsError.message,
      timestamp: new Date().toISOString(),
    })
  }

  try {
    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      <PerformancePDF audit={audit} results={results || []} />
    )

    // Generate filename
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `performance-audit-${dateStr}.pdf`

    // Return PDF with proper headers
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('[Performance PDF Export Error]', {
      type: 'pdf_generation_failed',
      auditId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
