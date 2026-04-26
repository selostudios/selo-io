import { afterAll, describe, expect, test } from 'vitest'
import { createServiceClient } from '@/lib/supabase/server'
import { seedOrgWithDraft, type SeededReview } from '../helpers/reviews'

const seeded: SeededReview[] = []

afterAll(async () => {
  for (const fixture of seeded) {
    await fixture.cleanup()
  }
})

describe('marketing_review_drafts.hidden_slides', () => {
  test('defaults to empty text[] and accepts narrative-block keys', async () => {
    const fixture = await seedOrgWithDraft()
    seeded.push(fixture)
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
    const fixture = await seedOrgWithDraft({ withSnapshot: true })
    seeded.push(fixture)
    const supabase = createServiceClient()

    const { data } = await supabase
      .from('marketing_review_snapshots')
      .select('hidden_slides')
      .eq('id', fixture.snapshotId!)
      .single()
    expect(data?.hidden_slides).toEqual([])
  })
})
