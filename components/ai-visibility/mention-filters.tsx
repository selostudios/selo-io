'use client'

import { useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { AIPlatform, BrandSentiment } from '@/lib/enums'
import { PLATFORM_DISPLAY_NAMES, SENTIMENT_DISPLAY_NAMES } from '@/lib/ai-visibility/types'

const ALL_VALUE = '__all__'

export function MentionFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchTimeout = useRef<NodeJS.Timeout>(undefined)

  const currentPlatform = searchParams.get('platform') ?? ALL_VALUE
  const currentSentiment = searchParams.get('sentiment') ?? ALL_VALUE
  const currentDays = searchParams.get('days') ?? '30'
  const currentSearch = searchParams.get('search') ?? ''

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === ALL_VALUE || value === '') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Input
        placeholder="Search mentions..."
        defaultValue={currentSearch}
        onChange={(e) => {
          const value = e.target.value
          clearTimeout(searchTimeout.current)
          searchTimeout.current = setTimeout(() => {
            updateFilter('search', value)
          }, 300)
        }}
        className="w-[200px]"
      />
      <Select value={currentPlatform} onValueChange={(v) => updateFilter('platform', v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Platforms" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All Platforms</SelectItem>
          {Object.values(AIPlatform).map((platform) => (
            <SelectItem key={platform} value={platform}>
              {PLATFORM_DISPLAY_NAMES[platform]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentSentiment} onValueChange={(v) => updateFilter('sentiment', v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Sentiment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All Sentiment</SelectItem>
          {Object.values(BrandSentiment).map((sentiment) => (
            <SelectItem key={sentiment} value={sentiment}>
              {SENTIMENT_DISPLAY_NAMES[sentiment]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentDays} onValueChange={(v) => updateFilter('days', v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7">Last 7 days</SelectItem>
          <SelectItem value="30">Last 30 days</SelectItem>
          <SelectItem value="90">Last 90 days</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
