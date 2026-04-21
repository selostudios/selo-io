'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ShareModal } from '@/components/share/share-modal'
import { SharedResourceType } from '@/lib/enums'

export interface SnapshotListItem {
  id: string
  version: number
  publishedAt: string
  publishedByName: string | null
  hasShareLink: boolean
}

export interface SnapshotsTableProps {
  snapshots: SnapshotListItem[]
  /** Base path used to build `{base}/{snapshotId}` links for version + view actions. */
  basePath: string
}

/**
 * Per-row Share button. Each row owns its own open/close state and mounts
 * its own ShareModal keyed to that snapshot's id — this guarantees
 * clicking row #3's button can't accidentally share row #1's snapshot.
 */
export function SnapshotRowShareButton({
  snapshotId,
  version,
}: {
  snapshotId: string
  version: number
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        data-testid={`performance-reports-snapshots-share-button-${snapshotId}`}
        aria-label={`Share version ${version}`}
      >
        <Share2 className="mr-2 size-4" aria-hidden="true" />
        Share
      </Button>
      <ShareModal
        open={open}
        onOpenChange={setOpen}
        resourceType={SharedResourceType.MarketingReview}
        resourceId={snapshotId}
      />
    </>
  )
}

/**
 * Client-side table for the snapshots list.
 *
 * Kept as a client component because each row mounts its own ShareModal
 * (which requires state + portals). The surrounding page is server-rendered
 * and passes pre-resolved publisher names + share-link status so this
 * component stays purely presentational — no extra data fetching.
 *
 * Renders a centred EmptyState when `snapshots` is empty so the page doesn't
 * need to branch.
 */
export function SnapshotsTable({ snapshots, basePath }: SnapshotsTableProps) {
  if (snapshots.length === 0) {
    return (
      <div data-testid="performance-reports-snapshots-empty-state">
        <EmptyState
          icon={FileText}
          title="No snapshots yet"
          description="Publish the review from the editor or preview to create a snapshot."
        />
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Version</TableHead>
            <TableHead>Published</TableHead>
            <TableHead>Published by</TableHead>
            <TableHead>Share status</TableHead>
            <TableHead className="w-[1%]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {snapshots.map((snap) => {
            const snapshotHref = `${basePath}/${snap.id}`
            return (
              <TableRow key={snap.id} data-testid={`performance-reports-snapshots-row-${snap.id}`}>
                <TableCell className="font-medium">
                  <Link
                    href={snapshotHref}
                    className="hover:text-primary hover:underline"
                    data-testid={`performance-reports-snapshots-version-link-${snap.id}`}
                  >
                    v{snap.version}
                  </Link>
                </TableCell>
                <TableCell>{snap.publishedAt}</TableCell>
                <TableCell>{snap.publishedByName ?? '—'}</TableCell>
                <TableCell>{snap.hasShareLink ? 'Link created' : 'Not shared'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      data-testid={`performance-reports-snapshots-view-button-${snap.id}`}
                    >
                      <Link href={snapshotHref}>View</Link>
                    </Button>
                    <SnapshotRowShareButton snapshotId={snap.id} version={snap.version} />
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
