import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'linkedin-post-thumbnails'
const CONCURRENCY = 5

export interface ThumbnailJob {
  organizationId: string
  linkedinUrn: string
  imageCdnUrl: string
}

/**
 * Downloads LinkedIn post thumbnails from their CDN URLs and uploads them to
 * Supabase Storage at `{organizationId}/{linkedin_urn}.jpg`.
 *
 * Runs at most {@link CONCURRENCY} (5) downloads in parallel via a shared queue.
 * Individual failures (network errors, non-OK responses, upload errors) are
 * logged and skipped — the function never throws.
 *
 * @returns Map from `linkedin_urn` to stored `thumbnail_path` for successful uploads.
 */
export async function downloadThumbnails(
  supabase: SupabaseClient,
  jobs: ThumbnailJob[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (jobs.length === 0) return out

  const queue = [...jobs]
  const workerCount = Math.min(CONCURRENCY, queue.length)

  const workers = Array.from({ length: workerCount }, async () => {
    while (queue.length > 0) {
      const job = queue.shift()
      if (!job) break
      try {
        const res = await fetch(job.imageCdnUrl)
        if (!res.ok) continue
        const buf = new Uint8Array(await res.arrayBuffer())
        const path = `${job.organizationId}/${job.linkedinUrn}.jpg`
        const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
          contentType: 'image/jpeg',
          upsert: true,
        })
        if (!error) out.set(job.linkedinUrn, path)
      } catch (err) {
        console.error('[LinkedIn Thumbnail] download failed', {
          type: 'thumbnail_download_error',
          linkedinUrn: job.linkedinUrn,
          error: err instanceof Error ? err.message : 'unknown',
          timestamp: new Date().toISOString(),
        })
      }
    }
  })

  await Promise.all(workers)
  return out
}
