import { afterAll, describe, expect, test } from 'vitest'
import { createServiceClient } from '@/lib/supabase/server'
import { seedOrgWithDraft, type SeededReview } from '../helpers/reviews'

const seeded: SeededReview[] = []

/**
 * Tracks a fixture for teardown immediately on creation. If the helper throws
 * partway through it already cleans itself up, but if any later assertion
 * throws we still want the fixture removed — that's what `afterAll` is for.
 */
async function track(promise: Promise<SeededReview>): Promise<SeededReview> {
  const fixture = await promise
  seeded.push(fixture)
  return fixture
}

afterAll(async () => {
  for (const fixture of seeded) {
    await fixture.cleanup()
  }
})

describe('marketing_review_drafts.hidden_slides', () => {
  test('defaults to empty text[] and accepts narrative-block keys', async () => {
    const fixture = await track(seedOrgWithDraft())
    const supabase = createServiceClient()

    const { data: draft } = await supabase
      .from('marketing_review_drafts')
      .select('hidden_slides')
      .eq('review_id', fixture.reviewId)
      .single()
    expect(draft?.hidden_slides).toEqual([])

    const { error } = await supabase
      .from('marketing_review_drafts')
      .update({ hidden_slides: ['ga_summary'] })
      .eq('review_id', fixture.reviewId)
    expect(error).toBeNull()
  })

  test('marketing_review_snapshots.hidden_slides defaults to empty', async () => {
    const fixture = await track(seedOrgWithDraft({ withSnapshot: true }))
    const supabase = createServiceClient()

    const { data } = await supabase
      .from('marketing_review_snapshots')
      .select('hidden_slides')
      .eq('id', fixture.snapshotId!)
      .single()
    expect(data?.hidden_slides).toEqual([])
  })
})
