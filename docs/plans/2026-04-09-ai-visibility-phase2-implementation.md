# AI Visibility Phase 2 — Platform Adapters & Analysis Pipeline

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the platform adapter layer (ChatGPT, Claude, Perplexity) and the response analysis pipeline (mention detection, citation extraction, sentiment analysis, competitor detection).

**Architecture:** Each AI platform gets a thin adapter wrapping the Vercel AI SDK (`generateText()`). A shared `AIProviderAdapter` interface ensures all adapters return the same `AIProviderResponse` shape. The analyzer module processes responses through four independent pure-function steps. All TDD with mock fixtures.

**Tech Stack:** Vercel AI SDK (`ai`), `@ai-sdk/openai` (new), `@ai-sdk/perplexity` (new), `@ai-sdk/anthropic` (existing), Vitest for testing.

**Depends on:** Phase 1 complete (types in `lib/ai-visibility/types.ts`, enums in `lib/enums.ts`).

---

### Task 1: Install AI SDK provider packages

**Files:**

- Modify: `package.json`

**Step 1: Install packages**

Run:

```bash
npm install @ai-sdk/openai @ai-sdk/perplexity
```

**Step 2: Verify installation**

Run: `npm ls @ai-sdk/openai @ai-sdk/perplexity`
Expected: Both packages listed

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @ai-sdk/openai and @ai-sdk/perplexity"
```

---

### Task 2: Adapter interface and shared types

**Files:**

- Create: `lib/ai-visibility/platforms/types.ts`
- Test: `tests/unit/lib/ai-visibility/platforms/types.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/lib/ai-visibility/platforms/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  type AIProviderAdapter,
  type AIProviderResponse,
  PLATFORM_COSTS,
  estimateCostCents,
} from '@/lib/ai-visibility/platforms/types'
import { AIPlatform } from '@/lib/enums'

describe('AI Provider platform types', () => {
  it('PLATFORM_COSTS contains cost info for all platforms', () => {
    expect(PLATFORM_COSTS[AIPlatform.ChatGPT]).toBeDefined()
    expect(PLATFORM_COSTS[AIPlatform.Claude]).toBeDefined()
    expect(PLATFORM_COSTS[AIPlatform.Perplexity]).toBeDefined()
    expect(PLATFORM_COSTS[AIPlatform.ChatGPT].inputPerMillionTokens).toBeGreaterThan(0)
  })

  it('estimateCostCents calculates cost from token counts', () => {
    // ChatGPT: $2.50 input, $10 output per 1M tokens
    // 1000 input + 500 output = 0.0025 + 0.005 = 0.0075 dollars = ~1 cent
    const cost = estimateCostCents(AIPlatform.ChatGPT, 1000, 500)
    expect(cost).toBeGreaterThan(0)
    expect(typeof cost).toBe('number')
  })

  it('estimateCostCents returns 0 for zero tokens', () => {
    expect(estimateCostCents(AIPlatform.ChatGPT, 0, 0)).toBe(0)
  })

  it('type-checks AIProviderResponse', () => {
    const response: AIProviderResponse = {
      text: 'Warby Parker is a great eyewear brand...',
      citations: ['https://warbyparker.com'],
      model: 'gpt-4o-mini',
      inputTokens: 100,
      outputTokens: 200,
      costCents: 1,
    }
    expect(response.text).toContain('Warby Parker')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest tests/unit/lib/ai-visibility/platforms/types.test.ts`
Expected: FAIL — module does not exist

**Step 3: Create the types file**

Create `lib/ai-visibility/platforms/types.ts`:

```typescript
import { AIPlatform } from '@/lib/enums'

// =============================================================================
// Adapter Interface
// =============================================================================

/**
 * Every AI platform adapter must implement this interface.
 * The sync pipeline calls `query()` and processes the standardized response.
 */
export interface AIProviderAdapter {
  platform: AIPlatform
  query(prompt: string): Promise<AIProviderResponse>
}

/**
 * Standardized response from any AI platform.
 * Adapters normalize platform-specific responses into this shape.
 */
export interface AIProviderResponse {
  text: string
  citations: string[]
  model: string
  inputTokens: number
  outputTokens: number
  costCents: number
}

// =============================================================================
// Cost Calculation
// =============================================================================

interface PlatformCost {
  inputPerMillionTokens: number // USD
  outputPerMillionTokens: number // USD
}

export const PLATFORM_COSTS: Record<AIPlatform, PlatformCost> = {
  [AIPlatform.ChatGPT]: {
    inputPerMillionTokens: 2.5, // GPT-4o mini
    outputPerMillionTokens: 10,
  },
  [AIPlatform.Claude]: {
    inputPerMillionTokens: 3, // Claude Sonnet
    outputPerMillionTokens: 15,
  },
  [AIPlatform.Perplexity]: {
    inputPerMillionTokens: 1, // Sonar
    outputPerMillionTokens: 1,
  },
}

/**
 * Estimate cost in cents from token counts for a given platform.
 */
export function estimateCostCents(
  platform: AIPlatform,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = PLATFORM_COSTS[platform]
  const dollars =
    (inputTokens / 1_000_000) * costs.inputPerMillionTokens +
    (outputTokens / 1_000_000) * costs.outputPerMillionTokens
  return Math.round(dollars * 100)
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest tests/unit/lib/ai-visibility/platforms/types.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/ai-visibility/platforms/types.ts tests/unit/lib/ai-visibility/platforms/types.test.ts
git commit -m "feat: add AIProviderAdapter interface and cost estimation"
```

---

### Task 3: ChatGPT adapter

**Files:**

- Create: `lib/ai-visibility/platforms/chatgpt/adapter.ts`
- Test: `tests/unit/lib/ai-visibility/platforms/chatgpt/adapter.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/lib/ai-visibility/platforms/chatgpt/adapter.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AIPlatform } from '@/lib/enums'

// Mock the AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn().mockReturnValue('mocked-model'),
}))

import { ChatGPTAdapter } from '@/lib/ai-visibility/platforms/chatgpt/adapter'
import { generateText } from 'ai'

describe('ChatGPTAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has platform set to ChatGPT', () => {
    const adapter = new ChatGPTAdapter()
    expect(adapter.platform).toBe(AIPlatform.ChatGPT)
  })

  it('returns a standardized response from OpenAI', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'Warby Parker is known for affordable eyewear. Visit https://warbyparker.com for more.',
      usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
    } as any)

    const adapter = new ChatGPTAdapter()
    const result = await adapter.query('Tell me about Warby Parker')

    expect(result.text).toContain('Warby Parker')
    expect(result.model).toBe('gpt-4o-mini')
    expect(result.inputTokens).toBe(50)
    expect(result.outputTokens).toBe(100)
    expect(result.costCents).toBeGreaterThanOrEqual(0)
    expect(result.citations).toEqual([]) // ChatGPT doesn't return native citations
  })

  it('passes the prompt to generateText', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'Response',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    } as any)

    const adapter = new ChatGPTAdapter()
    await adapter.query('What is the best eyewear brand?')

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'What is the best eyewear brand?',
      })
    )
  })

  it('handles API errors gracefully', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('Rate limit exceeded'))

    const adapter = new ChatGPTAdapter()
    await expect(adapter.query('test')).rejects.toThrow('ChatGPT query failed: Rate limit exceeded')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest tests/unit/lib/ai-visibility/platforms/chatgpt/adapter.test.ts`
Expected: FAIL — module does not exist

**Step 3: Create the adapter**

Create `lib/ai-visibility/platforms/chatgpt/adapter.ts`:

```typescript
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { AIPlatform } from '@/lib/enums'
import type { AIProviderAdapter, AIProviderResponse } from '../types'
import { estimateCostCents } from '../types'

const MODEL = 'gpt-4o-mini'

export class ChatGPTAdapter implements AIProviderAdapter {
  platform = AIPlatform.ChatGPT

  async query(prompt: string): Promise<AIProviderResponse> {
    try {
      const { text, usage } = await generateText({
        model: openai(MODEL),
        prompt,
      })

      const inputTokens = usage?.promptTokens ?? 0
      const outputTokens = usage?.completionTokens ?? 0

      return {
        text,
        citations: [], // ChatGPT doesn't return native citations
        model: MODEL,
        inputTokens,
        outputTokens,
        costCents: estimateCostCents(AIPlatform.ChatGPT, inputTokens, outputTokens),
      }
    } catch (error) {
      throw new Error(
        `ChatGPT query failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest tests/unit/lib/ai-visibility/platforms/chatgpt/adapter.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/ai-visibility/platforms/chatgpt/ tests/unit/lib/ai-visibility/platforms/chatgpt/
git commit -m "feat: add ChatGPT adapter for AI visibility"
```

---

### Task 4: Claude adapter

**Files:**

- Create: `lib/ai-visibility/platforms/claude/adapter.ts`
- Test: `tests/unit/lib/ai-visibility/platforms/claude/adapter.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/lib/ai-visibility/platforms/claude/adapter.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AIPlatform } from '@/lib/enums'

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn().mockReturnValue('mocked-model'),
}))

import { ClaudeAdapter } from '@/lib/ai-visibility/platforms/claude/adapter'
import { generateText } from 'ai'

describe('ClaudeAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has platform set to Claude', () => {
    const adapter = new ClaudeAdapter()
    expect(adapter.platform).toBe(AIPlatform.Claude)
  })

  it('returns a standardized response from Anthropic', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'Warby Parker offers prescription glasses online.',
      usage: { promptTokens: 40, completionTokens: 80, totalTokens: 120 },
    } as any)

    const adapter = new ClaudeAdapter()
    const result = await adapter.query('Tell me about Warby Parker')

    expect(result.text).toContain('Warby Parker')
    expect(result.model).toBe('claude-sonnet-4-20250514')
    expect(result.inputTokens).toBe(40)
    expect(result.outputTokens).toBe(80)
    expect(result.costCents).toBeGreaterThanOrEqual(0)
    expect(result.citations).toEqual([]) // Claude doesn't return native citations
  })

  it('handles API errors gracefully', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('Overloaded'))

    const adapter = new ClaudeAdapter()
    await expect(adapter.query('test')).rejects.toThrow('Claude query failed: Overloaded')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest tests/unit/lib/ai-visibility/platforms/claude/adapter.test.ts`
Expected: FAIL — module does not exist

**Step 3: Create the adapter**

Create `lib/ai-visibility/platforms/claude/adapter.ts`:

```typescript
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { AIPlatform } from '@/lib/enums'
import type { AIProviderAdapter, AIProviderResponse } from '../types'
import { estimateCostCents } from '../types'

const MODEL = 'claude-sonnet-4-20250514'

export class ClaudeAdapter implements AIProviderAdapter {
  platform = AIPlatform.Claude

  async query(prompt: string): Promise<AIProviderResponse> {
    try {
      const { text, usage } = await generateText({
        model: anthropic(MODEL),
        prompt,
      })

      const inputTokens = usage?.promptTokens ?? 0
      const outputTokens = usage?.completionTokens ?? 0

      return {
        text,
        citations: [], // Claude doesn't return native citations
        model: MODEL,
        inputTokens,
        outputTokens,
        costCents: estimateCostCents(AIPlatform.Claude, inputTokens, outputTokens),
      }
    } catch (error) {
      throw new Error(
        `Claude query failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest tests/unit/lib/ai-visibility/platforms/claude/adapter.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/ai-visibility/platforms/claude/ tests/unit/lib/ai-visibility/platforms/claude/
git commit -m "feat: add Claude adapter for AI visibility"
```

---

### Task 5: Perplexity adapter

**Files:**

- Create: `lib/ai-visibility/platforms/perplexity/adapter.ts`
- Test: `tests/unit/lib/ai-visibility/platforms/perplexity/adapter.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/lib/ai-visibility/platforms/perplexity/adapter.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AIPlatform } from '@/lib/enums'

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

vi.mock('@ai-sdk/perplexity', () => ({
  perplexity: vi.fn().mockReturnValue('mocked-model'),
}))

import { PerplexityAdapter } from '@/lib/ai-visibility/platforms/perplexity/adapter'
import { generateText } from 'ai'

describe('PerplexityAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has platform set to Perplexity', () => {
    const adapter = new PerplexityAdapter()
    expect(adapter.platform).toBe(AIPlatform.Perplexity)
  })

  it('returns a standardized response with native citations', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'Warby Parker is a popular eyewear retailer [1].',
      sources: [
        { url: 'https://warbyparker.com', title: 'Warby Parker' },
        { url: 'https://example.com/review', title: 'Review' },
      ],
      usage: { promptTokens: 30, completionTokens: 60, totalTokens: 90 },
    } as any)

    const adapter = new PerplexityAdapter()
    const result = await adapter.query('Tell me about Warby Parker')

    expect(result.text).toContain('Warby Parker')
    expect(result.model).toBe('sonar')
    expect(result.citations).toEqual(['https://warbyparker.com', 'https://example.com/review'])
    expect(result.inputTokens).toBe(30)
    expect(result.outputTokens).toBe(60)
  })

  it('handles missing sources gracefully', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'Some response without citations.',
      sources: undefined,
      usage: { promptTokens: 20, completionTokens: 40, totalTokens: 60 },
    } as any)

    const adapter = new PerplexityAdapter()
    const result = await adapter.query('test')

    expect(result.citations).toEqual([])
  })

  it('handles API errors gracefully', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('Service unavailable'))

    const adapter = new PerplexityAdapter()
    await expect(adapter.query('test')).rejects.toThrow(
      'Perplexity query failed: Service unavailable'
    )
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest tests/unit/lib/ai-visibility/platforms/perplexity/adapter.test.ts`
Expected: FAIL — module does not exist

**Step 3: Create the adapter**

Create `lib/ai-visibility/platforms/perplexity/adapter.ts`:

```typescript
import { generateText } from 'ai'
import { perplexity } from '@ai-sdk/perplexity'
import { AIPlatform } from '@/lib/enums'
import type { AIProviderAdapter, AIProviderResponse } from '../types'
import { estimateCostCents } from '../types'

const MODEL = 'sonar'

interface PerplexitySource {
  url: string
  title?: string
}

export class PerplexityAdapter implements AIProviderAdapter {
  platform = AIPlatform.Perplexity

  async query(prompt: string): Promise<AIProviderResponse> {
    try {
      const result = await generateText({
        model: perplexity(MODEL),
        prompt,
        providerOptions: {
          perplexity: {
            search_recency_filter: 'month',
          },
        },
      })

      const inputTokens = result.usage?.promptTokens ?? 0
      const outputTokens = result.usage?.completionTokens ?? 0

      // Extract citation URLs from Perplexity's native sources
      const sources = (result as unknown as { sources?: PerplexitySource[] }).sources
      const citations = (sources ?? []).map((s) => s.url).filter(Boolean)

      return {
        text: result.text,
        citations,
        model: MODEL,
        inputTokens,
        outputTokens,
        costCents: estimateCostCents(AIPlatform.Perplexity, inputTokens, outputTokens),
      }
    } catch (error) {
      throw new Error(
        `Perplexity query failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest tests/unit/lib/ai-visibility/platforms/perplexity/adapter.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/ai-visibility/platforms/perplexity/ tests/unit/lib/ai-visibility/platforms/perplexity/
git commit -m "feat: add Perplexity adapter for AI visibility"
```

---

### Task 6: Adapter registry

**Files:**

- Create: `lib/ai-visibility/platforms/registry.ts`
- Test: `tests/unit/lib/ai-visibility/platforms/registry.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/lib/ai-visibility/platforms/registry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { AIPlatform } from '@/lib/enums'
import { getAdapter, getAdapters } from '@/lib/ai-visibility/platforms/registry'

describe('Adapter registry', () => {
  it('returns ChatGPT adapter for ChatGPT platform', () => {
    const adapter = getAdapter(AIPlatform.ChatGPT)
    expect(adapter.platform).toBe(AIPlatform.ChatGPT)
  })

  it('returns Claude adapter for Claude platform', () => {
    const adapter = getAdapter(AIPlatform.Claude)
    expect(adapter.platform).toBe(AIPlatform.Claude)
  })

  it('returns Perplexity adapter for Perplexity platform', () => {
    const adapter = getAdapter(AIPlatform.Perplexity)
    expect(adapter.platform).toBe(AIPlatform.Perplexity)
  })

  it('returns multiple adapters for a list of platforms', () => {
    const adapters = getAdapters([AIPlatform.ChatGPT, AIPlatform.Perplexity])
    expect(adapters).toHaveLength(2)
    expect(adapters[0].platform).toBe(AIPlatform.ChatGPT)
    expect(adapters[1].platform).toBe(AIPlatform.Perplexity)
  })

  it('throws for unknown platform', () => {
    expect(() => getAdapter('unknown' as AIPlatform)).toThrow('No adapter for platform: unknown')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest tests/unit/lib/ai-visibility/platforms/registry.test.ts`
Expected: FAIL — module does not exist

**Step 3: Create the registry**

Create `lib/ai-visibility/platforms/registry.ts`:

```typescript
import { AIPlatform } from '@/lib/enums'
import type { AIProviderAdapter } from './types'
import { ChatGPTAdapter } from './chatgpt/adapter'
import { ClaudeAdapter } from './claude/adapter'
import { PerplexityAdapter } from './perplexity/adapter'

const adapters: Record<AIPlatform, () => AIProviderAdapter> = {
  [AIPlatform.ChatGPT]: () => new ChatGPTAdapter(),
  [AIPlatform.Claude]: () => new ClaudeAdapter(),
  [AIPlatform.Perplexity]: () => new PerplexityAdapter(),
}

export function getAdapter(platform: AIPlatform): AIProviderAdapter {
  const factory = adapters[platform]
  if (!factory) {
    throw new Error(`No adapter for platform: ${platform}`)
  }
  return factory()
}

export function getAdapters(platforms: AIPlatform[]): AIProviderAdapter[] {
  return platforms.map(getAdapter)
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest tests/unit/lib/ai-visibility/platforms/registry.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/ai-visibility/platforms/registry.ts tests/unit/lib/ai-visibility/platforms/registry.test.ts
git commit -m "feat: add adapter registry for AI visibility platforms"
```

---

### Task 7: Brand mention detection

**Files:**

- Create: `lib/ai-visibility/analyzer.ts`
- Test: `tests/unit/lib/ai-visibility/analyzer.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/lib/ai-visibility/analyzer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { detectBrandMention } from '@/lib/ai-visibility/analyzer'

describe('detectBrandMention', () => {
  const brandName = 'Warby Parker'

  it('detects a brand mention in the response', () => {
    const result = detectBrandMention(
      'Warby Parker is a popular eyewear retailer known for affordable glasses.',
      brandName
    )
    expect(result.mentioned).toBe(true)
    expect(result.mentionCount).toBe(1)
  })

  it('detects multiple mentions', () => {
    const result = detectBrandMention(
      'Warby Parker offers great frames. Many people choose Warby Parker for their first pair.',
      brandName
    )
    expect(result.mentioned).toBe(true)
    expect(result.mentionCount).toBe(2)
  })

  it('is case-insensitive', () => {
    const result = detectBrandMention('warby parker has expanded internationally.', brandName)
    expect(result.mentioned).toBe(true)
  })

  it('returns not mentioned when brand is absent', () => {
    const result = detectBrandMention(
      'Zenni Optical offers budget-friendly prescription glasses online.',
      brandName
    )
    expect(result.mentioned).toBe(false)
    expect(result.mentionCount).toBe(0)
    expect(result.position).toBeNull()
  })

  it('calculates position in first third', () => {
    const result = detectBrandMention(
      'Warby Parker is great. The rest of this text is filler. More filler text here to pad it out significantly.',
      brandName
    )
    expect(result.position).toBe(1)
  })

  it('calculates position in last third', () => {
    const result = detectBrandMention(
      'There are many eyewear brands available today. You have lots of options to consider. In conclusion, Warby Parker is worth checking out.',
      brandName
    )
    expect(result.position).toBe(3)
  })

  it('handles empty text', () => {
    const result = detectBrandMention('', brandName)
    expect(result.mentioned).toBe(false)
  })

  it('handles brand aliases', () => {
    const result = detectBrandMention('WP eyewear has great customer service.', brandName, ['WP'])
    expect(result.mentioned).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest tests/unit/lib/ai-visibility/analyzer.test.ts`
Expected: FAIL — module does not exist

**Step 3: Create the analyzer with mention detection**

Create `lib/ai-visibility/analyzer.ts`:

```typescript
export interface BrandMentionResult {
  mentioned: boolean
  mentionCount: number
  position: number | null // 1=first third, 2=middle, 3=last third
}

/**
 * Detect brand mentions in an AI response.
 * Case-insensitive, supports aliases.
 */
export function detectBrandMention(
  text: string,
  brandName: string,
  aliases: string[] = []
): BrandMentionResult {
  if (!text) {
    return { mentioned: false, mentionCount: 0, position: null }
  }

  const lowerText = text.toLowerCase()
  const searchTerms = [brandName, ...aliases]

  let totalCount = 0
  let firstIndex = -1

  for (const term of searchTerms) {
    const lowerTerm = term.toLowerCase()
    let startPos = 0
    while (true) {
      const idx = lowerText.indexOf(lowerTerm, startPos)
      if (idx === -1) break
      totalCount++
      if (firstIndex === -1 || idx < firstIndex) {
        firstIndex = idx
      }
      startPos = idx + lowerTerm.length
    }
  }

  if (totalCount === 0) {
    return { mentioned: false, mentionCount: 0, position: null }
  }

  // Calculate position: which third of the text the first mention appears in
  const relativePosition = firstIndex / text.length
  const position = relativePosition < 0.33 ? 1 : relativePosition < 0.66 ? 2 : 3

  return { mentioned: true, mentionCount: totalCount, position }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest tests/unit/lib/ai-visibility/analyzer.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/ai-visibility/analyzer.ts tests/unit/lib/ai-visibility/analyzer.test.ts
git commit -m "feat: add brand mention detection to analyzer"
```

---

### Task 8: Citation extraction

**Files:**

- Modify: `lib/ai-visibility/analyzer.ts`
- Modify: `tests/unit/lib/ai-visibility/analyzer.test.ts`

**Step 1: Add failing tests**

Append to `tests/unit/lib/ai-visibility/analyzer.test.ts`:

```typescript
import { detectBrandMention, extractCitations } from '@/lib/ai-visibility/analyzer'

describe('extractCitations', () => {
  const domain = 'warbyparker.com'

  it('extracts domain citations from native citation URLs', () => {
    const result = extractCitations(
      [
        'https://warbyparker.com/glasses',
        'https://zenni.com/frames',
        'https://www.warbyparker.com/about',
      ],
      domain
    )
    expect(result.domainCited).toBe(true)
    expect(result.citedUrls).toEqual([
      'https://warbyparker.com/glasses',
      'https://www.warbyparker.com/about',
    ])
  })

  it('extracts URLs from response text when no native citations', () => {
    const result = extractCitations(
      [],
      domain,
      'Check out https://warbyparker.com/glasses for more info. Also see https://example.com.'
    )
    expect(result.domainCited).toBe(true)
    expect(result.citedUrls).toEqual(['https://warbyparker.com/glasses'])
  })

  it('returns not cited when domain is absent', () => {
    const result = extractCitations(['https://zenni.com/frames'], domain)
    expect(result.domainCited).toBe(false)
    expect(result.citedUrls).toEqual([])
  })

  it('handles empty inputs', () => {
    const result = extractCitations([], domain)
    expect(result.domainCited).toBe(false)
    expect(result.citedUrls).toEqual([])
  })

  it('matches domain with www prefix', () => {
    const result = extractCitations(['https://www.warbyparker.com/shop'], domain)
    expect(result.domainCited).toBe(true)
  })

  it('deduplicates URLs', () => {
    const result = extractCitations(
      ['https://warbyparker.com/glasses', 'https://warbyparker.com/glasses'],
      domain
    )
    expect(result.citedUrls).toEqual(['https://warbyparker.com/glasses'])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest tests/unit/lib/ai-visibility/analyzer.test.ts -t "extractCitations"`
Expected: FAIL — `extractCitations` not exported

**Step 3: Add citation extraction to analyzer**

Add to `lib/ai-visibility/analyzer.ts`:

```typescript
export interface CitationResult {
  domainCited: boolean
  citedUrls: string[]
}

/**
 * Extract citations matching the org's domain.
 * First checks native citation URLs (from Perplexity), then falls back to
 * parsing URLs from the response text (for ChatGPT/Claude).
 */
export function extractCitations(
  nativeCitations: string[],
  domain: string,
  responseText?: string
): CitationResult {
  const domainLower = domain.toLowerCase()

  const matchesDomain = (url: string): boolean => {
    try {
      const hostname = new URL(url).hostname.toLowerCase()
      return hostname === domainLower || hostname === `www.${domainLower}`
    } catch {
      return false
    }
  }

  // Check native citations first
  let matchingUrls = nativeCitations.filter(matchesDomain)

  // Fall back to parsing URLs from text if no native citations provided
  if (matchingUrls.length === 0 && responseText) {
    const urlRegex = /https?:\/\/[^\s)>\]"']+/g
    const textUrls = responseText.match(urlRegex) ?? []
    matchingUrls = textUrls.filter(matchesDomain)
  }

  // Deduplicate
  const unique = [...new Set(matchingUrls)]

  return {
    domainCited: unique.length > 0,
    citedUrls: unique,
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest tests/unit/lib/ai-visibility/analyzer.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/ai-visibility/analyzer.ts tests/unit/lib/ai-visibility/analyzer.test.ts
git commit -m "feat: add citation extraction to analyzer"
```

---

### Task 9: Competitor detection

**Files:**

- Modify: `lib/ai-visibility/analyzer.ts`
- Modify: `tests/unit/lib/ai-visibility/analyzer.test.ts`

**Step 1: Add failing tests**

Append to test file:

```typescript
import {
  detectBrandMention,
  extractCitations,
  detectCompetitors,
} from '@/lib/ai-visibility/analyzer'

describe('detectCompetitors', () => {
  it('detects competitor mentions in response text', () => {
    const result = detectCompetitors(
      'Both Zenni Optical and EyeBuyDirect offer affordable frames online.',
      ['Zenni Optical', 'EyeBuyDirect', 'LensCrafters'],
      ['https://zenni.com/frames']
    )
    expect(result).toEqual([
      { name: 'Zenni Optical', mentioned: true, cited: true },
      { name: 'EyeBuyDirect', mentioned: true, cited: false },
      { name: 'LensCrafters', mentioned: false, cited: false },
    ])
  })

  it('returns empty array when no competitors configured', () => {
    const result = detectCompetitors('Some text', [], [])
    expect(result).toEqual([])
  })

  it('is case-insensitive', () => {
    const result = detectCompetitors('zenni optical has good prices', ['Zenni Optical'], [])
    expect(result[0].mentioned).toBe(true)
  })

  it('detects citations matching competitor domains', () => {
    const result = detectCompetitors(
      'Check out these eyewear options.',
      ['Zenni Optical'],
      ['https://www.zenni.com/glasses'],
      { 'Zenni Optical': 'zenni.com' }
    )
    expect(result[0].cited).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest tests/unit/lib/ai-visibility/analyzer.test.ts -t "detectCompetitors"`
Expected: FAIL — `detectCompetitors` not exported

**Step 3: Add competitor detection to analyzer**

Add to `lib/ai-visibility/analyzer.ts`:

```typescript
import type { CompetitorMention } from './types'

/**
 * Detect competitor mentions and citations in an AI response.
 */
export function detectCompetitors(
  text: string,
  competitorNames: string[],
  allCitations: string[],
  competitorDomains?: Record<string, string>
): CompetitorMention[] {
  if (competitorNames.length === 0) return []

  const lowerText = text.toLowerCase()

  return competitorNames.map((name) => {
    const mentioned = lowerText.includes(name.toLowerCase())

    let cited = false
    if (competitorDomains?.[name]) {
      const domain = competitorDomains[name].toLowerCase()
      cited = allCitations.some((url) => {
        try {
          const hostname = new URL(url).hostname.toLowerCase()
          return hostname === domain || hostname === `www.${domain}`
        } catch {
          return false
        }
      })
    } else {
      // Heuristic: check if any citation URL contains the competitor name
      const nameParts = name.toLowerCase().split(/\s+/)
      const primaryPart = nameParts[0]
      cited = allCitations.some((url) => url.toLowerCase().includes(primaryPart))
    }

    return { name, mentioned, cited }
  })
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest tests/unit/lib/ai-visibility/analyzer.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/ai-visibility/analyzer.ts tests/unit/lib/ai-visibility/analyzer.test.ts
git commit -m "feat: add competitor detection to analyzer"
```

---

### Task 10: Sentiment analysis

**Files:**

- Create: `lib/ai-visibility/sentiment.ts`
- Test: `tests/unit/lib/ai-visibility/sentiment.test.ts`

**Step 1: Write failing tests**

Create `tests/unit/lib/ai-visibility/sentiment.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrandSentiment } from '@/lib/enums'

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn().mockReturnValue('mocked-model'),
}))

import { analyzeSentiment, analyzeSentimentBatch } from '@/lib/ai-visibility/sentiment'
import { generateText } from 'ai'

describe('analyzeSentiment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('classifies a positive mention', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'positive',
      usage: { promptTokens: 50, completionTokens: 5, totalTokens: 55 },
    } as any)

    const result = await analyzeSentiment(
      'Warby Parker offers excellent quality frames at unbeatable prices.',
      'Warby Parker'
    )
    expect(result.sentiment).toBe(BrandSentiment.Positive)
  })

  it('defaults to neutral on API failure', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('API error'))

    const result = await analyzeSentiment('Some text', 'Brand')
    expect(result.sentiment).toBe(BrandSentiment.Neutral)
    expect(result.costCents).toBe(0)
  })

  it('defaults to neutral on unexpected response', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'maybe slightly positive but also somewhat mixed',
      usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
    } as any)

    const result = await analyzeSentiment('Some text', 'Brand')
    expect(result.sentiment).toBe(BrandSentiment.Neutral)
  })

  it('tracks token cost', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'negative',
      usage: { promptTokens: 100, completionTokens: 5, totalTokens: 105 },
    } as any)

    const result = await analyzeSentiment('Terrible brand', 'Brand')
    expect(result.sentiment).toBe(BrandSentiment.Negative)
    expect(result.inputTokens).toBe(100)
    expect(result.outputTokens).toBe(5)
  })
})

describe('analyzeSentimentBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('classifies multiple responses in one API call', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify([
        { index: 0, sentiment: 'positive' },
        { index: 1, sentiment: 'negative' },
        { index: 2, sentiment: 'neutral' },
      ]),
      usage: { promptTokens: 200, completionTokens: 50, totalTokens: 250 },
    } as any)

    const items = [
      { text: 'Great brand!', brandName: 'Brand' },
      { text: 'Terrible service.', brandName: 'Brand' },
      { text: 'Brand exists.', brandName: 'Brand' },
    ]

    const result = await analyzeSentimentBatch(items)
    expect(result.sentiments).toEqual([
      BrandSentiment.Positive,
      BrandSentiment.Negative,
      BrandSentiment.Neutral,
    ])
  })

  it('returns neutral for all items on API failure', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('API error'))

    const items = [
      { text: 'Text 1', brandName: 'Brand' },
      { text: 'Text 2', brandName: 'Brand' },
    ]

    const result = await analyzeSentimentBatch(items)
    expect(result.sentiments).toEqual([BrandSentiment.Neutral, BrandSentiment.Neutral])
    expect(result.costCents).toBe(0)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest tests/unit/lib/ai-visibility/sentiment.test.ts`
Expected: FAIL — module does not exist

**Step 3: Create the sentiment module**

Create `lib/ai-visibility/sentiment.ts`:

```typescript
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { BrandSentiment } from '@/lib/enums'
import { estimateCostCents } from './platforms/types'
import { AIPlatform } from '@/lib/enums'

const MODEL = 'claude-haiku-4-5-20251001'

interface SentimentResult {
  sentiment: BrandSentiment
  inputTokens: number
  outputTokens: number
  costCents: number
}

interface BatchSentimentResult {
  sentiments: BrandSentiment[]
  inputTokens: number
  outputTokens: number
  costCents: number
}

function parseSentiment(text: string): BrandSentiment {
  const lower = text.trim().toLowerCase()
  if (lower === 'positive') return BrandSentiment.Positive
  if (lower === 'negative') return BrandSentiment.Negative
  if (lower === 'neutral') return BrandSentiment.Neutral
  return BrandSentiment.Neutral
}

/**
 * Classify sentiment of a single brand mention.
 * Falls back to neutral on any error.
 */
export async function analyzeSentiment(
  responseText: string,
  brandName: string
): Promise<SentimentResult> {
  try {
    const { text, usage } = await generateText({
      model: anthropic(MODEL),
      prompt: `Classify the sentiment toward "${brandName}" in the following text. Reply with exactly one word: positive, neutral, or negative.\n\nText: ${responseText}`,
      maxTokens: 10,
    })

    const inputTokens = usage?.promptTokens ?? 0
    const outputTokens = usage?.completionTokens ?? 0

    return {
      sentiment: parseSentiment(text),
      inputTokens,
      outputTokens,
      costCents: estimateCostCents(AIPlatform.Claude, inputTokens, outputTokens),
    }
  } catch {
    return { sentiment: BrandSentiment.Neutral, inputTokens: 0, outputTokens: 0, costCents: 0 }
  }
}

/**
 * Classify sentiment for multiple responses in a single API call.
 * More cost-effective than individual calls.
 * Falls back to neutral for all items on error.
 */
export async function analyzeSentimentBatch(
  items: { text: string; brandName: string }[]
): Promise<BatchSentimentResult> {
  if (items.length === 0) {
    return { sentiments: [], inputTokens: 0, outputTokens: 0, costCents: 0 }
  }

  try {
    const itemList = items
      .map((item, i) => `[${i}] Brand: "${item.brandName}"\nText: ${item.text}`)
      .join('\n\n')

    const { text, usage } = await generateText({
      model: anthropic(MODEL),
      prompt: `Classify the sentiment toward each brand in the texts below. Return a JSON array with objects containing "index" (number) and "sentiment" (one of: "positive", "neutral", "negative").\n\n${itemList}`,
      maxTokens: items.length * 30,
    })

    const inputTokens = usage?.promptTokens ?? 0
    const outputTokens = usage?.completionTokens ?? 0

    // Parse JSON response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    const sentiments = items.map((_, i) => {
      const entry = parsed.find((p: { index: number; sentiment: string }) => p.index === i)
      return entry ? parseSentiment(entry.sentiment) : BrandSentiment.Neutral
    })

    return {
      sentiments,
      inputTokens,
      outputTokens,
      costCents: estimateCostCents(AIPlatform.Claude, inputTokens, outputTokens),
    }
  } catch {
    return {
      sentiments: items.map(() => BrandSentiment.Neutral),
      inputTokens: 0,
      outputTokens: 0,
      costCents: 0,
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest tests/unit/lib/ai-visibility/sentiment.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/ai-visibility/sentiment.ts tests/unit/lib/ai-visibility/sentiment.test.ts
git commit -m "feat: add sentiment analysis with batch support"
```

---

### Task 11: Composed `analyzeResponse` function

Combine all analysis steps into a single entry point.

**Files:**

- Modify: `lib/ai-visibility/analyzer.ts`
- Modify: `tests/unit/lib/ai-visibility/analyzer.test.ts`

**Step 1: Add failing test**

Append to `tests/unit/lib/ai-visibility/analyzer.test.ts`:

```typescript
vi.mock('@/lib/ai-visibility/sentiment', () => ({
  analyzeSentiment: vi.fn().mockResolvedValue({
    sentiment: 'positive',
    inputTokens: 50,
    outputTokens: 5,
    costCents: 1,
  }),
}))

import { analyzeResponse } from '@/lib/ai-visibility/analyzer'

describe('analyzeResponse', () => {
  it('composes all analysis steps into a single result', async () => {
    const result = await analyzeResponse(
      {
        text: 'Warby Parker is a top eyewear brand. Zenni is also popular.',
        citations: ['https://warbyparker.com/glasses', 'https://zenni.com/frames'],
        model: 'gpt-4o-mini',
        inputTokens: 100,
        outputTokens: 200,
        costCents: 5,
      },
      {
        brandName: 'Warby Parker',
        domain: 'warbyparker.com',
        competitors: ['Zenni'],
      }
    )

    expect(result.brand_mentioned).toBe(true)
    expect(result.brand_sentiment).toBe('positive')
    expect(result.domain_cited).toBe(true)
    expect(result.cited_urls).toContain('https://warbyparker.com/glasses')
    expect(result.competitor_mentions).toHaveLength(1)
    expect(result.competitor_mentions![0].name).toBe('Zenni')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest tests/unit/lib/ai-visibility/analyzer.test.ts -t "analyzeResponse"`
Expected: FAIL — `analyzeResponse` not exported

**Step 3: Add the composed function**

Add to `lib/ai-visibility/analyzer.ts`:

```typescript
import type { AIProviderResponse } from './platforms/types'
import { analyzeSentiment } from './sentiment'

export interface OrgContext {
  brandName: string
  domain: string
  aliases?: string[]
  competitors?: string[]
  competitorDomains?: Record<string, string>
}

export interface AnalyzedResponse {
  brand_mentioned: boolean
  brand_sentiment: string
  brand_position: number | null
  domain_cited: boolean
  cited_urls: string[]
  competitor_mentions: CompetitorMention[] | null
  sentiment_cost_cents: number
}

/**
 * Run all analysis steps on an AI provider response.
 */
export async function analyzeResponse(
  response: AIProviderResponse,
  context: OrgContext
): Promise<AnalyzedResponse> {
  const mention = detectBrandMention(response.text, context.brandName, context.aliases)
  const citation = extractCitations(response.citations, context.domain, response.text)
  const competitors = detectCompetitors(
    response.text,
    context.competitors ?? [],
    response.citations,
    context.competitorDomains
  )

  // Only analyze sentiment if brand was mentioned
  let sentiment = BrandSentiment.Neutral
  let sentimentCostCents = 0
  if (mention.mentioned) {
    const sentimentResult = await analyzeSentiment(response.text, context.brandName)
    sentiment = sentimentResult.sentiment
    sentimentCostCents = sentimentResult.costCents
  }

  return {
    brand_mentioned: mention.mentioned,
    brand_sentiment: sentiment,
    brand_position: mention.position,
    domain_cited: citation.domainCited,
    cited_urls: citation.citedUrls,
    competitor_mentions: competitors.length > 0 ? competitors : null,
    sentiment_cost_cents: sentimentCostCents,
  }
}
```

You will need to add the `BrandSentiment` import at the top of `analyzer.ts`:

```typescript
import { BrandSentiment } from '@/lib/enums'
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest tests/unit/lib/ai-visibility/analyzer.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/ai-visibility/analyzer.ts tests/unit/lib/ai-visibility/analyzer.test.ts
git commit -m "feat: add composed analyzeResponse function"
```

---

### Task 12: AI Visibility scorer

**Files:**

- Create: `lib/ai-visibility/scorer.ts`
- Test: `tests/unit/lib/ai-visibility/scorer.test.ts`

**Step 1: Write failing tests**

Create `tests/unit/lib/ai-visibility/scorer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { BrandSentiment } from '@/lib/enums'
import { calculateVisibilityScore } from '@/lib/ai-visibility/scorer'

describe('calculateVisibilityScore', () => {
  it('returns 100 when all prompts are mentioned, cited, and positive', () => {
    const score = calculateVisibilityScore({
      totalPrompts: 10,
      mentionedCount: 10,
      citedCount: 10,
      sentiments: Array(10).fill(BrandSentiment.Positive),
    })
    expect(score).toBe(100)
  })

  it('returns 0 when no mentions, no citations, no positive sentiment', () => {
    const score = calculateVisibilityScore({
      totalPrompts: 10,
      mentionedCount: 0,
      citedCount: 0,
      sentiments: [],
    })
    expect(score).toBe(0)
  })

  it('returns 0 for zero prompts', () => {
    const score = calculateVisibilityScore({
      totalPrompts: 0,
      mentionedCount: 0,
      citedCount: 0,
      sentiments: [],
    })
    expect(score).toBe(0)
  })

  it('weights mentions at 40%, citations at 40%, sentiment at 20%', () => {
    // 50% mention rate (40% weight) = 20
    // 50% citation rate (40% weight) = 20
    // all neutral sentiment (50 pts, 20% weight) = 10
    const score = calculateVisibilityScore({
      totalPrompts: 10,
      mentionedCount: 5,
      citedCount: 5,
      sentiments: Array(5).fill(BrandSentiment.Neutral),
    })
    expect(score).toBe(50)
  })

  it('handles mixed sentiments correctly', () => {
    // 100% mention = 40
    // 0% citation = 0
    // 3 positive (100) + 2 negative (0) = avg 60, * 0.2 = 12
    const score = calculateVisibilityScore({
      totalPrompts: 5,
      mentionedCount: 5,
      citedCount: 0,
      sentiments: [
        BrandSentiment.Positive,
        BrandSentiment.Positive,
        BrandSentiment.Positive,
        BrandSentiment.Negative,
        BrandSentiment.Negative,
      ],
    })
    expect(score).toBe(52)
  })

  it('clamps score between 0 and 100', () => {
    const score = calculateVisibilityScore({
      totalPrompts: 1,
      mentionedCount: 1,
      citedCount: 1,
      sentiments: [BrandSentiment.Positive],
    })
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest tests/unit/lib/ai-visibility/scorer.test.ts`
Expected: FAIL — module does not exist

**Step 3: Create the scorer**

Create `lib/ai-visibility/scorer.ts`:

```typescript
import { BrandSentiment } from '@/lib/enums'

interface ScoreInput {
  totalPrompts: number
  mentionedCount: number
  citedCount: number
  sentiments: BrandSentiment[]
}

const SENTIMENT_SCORES: Record<BrandSentiment, number> = {
  [BrandSentiment.Positive]: 100,
  [BrandSentiment.Neutral]: 50,
  [BrandSentiment.Negative]: 0,
}

/**
 * Calculate AI Visibility Score (0-100).
 *
 * Weighted composite:
 *   mentionRate * 40% + citationRate * 40% + sentimentScore * 20%
 */
export function calculateVisibilityScore(input: ScoreInput): number {
  const { totalPrompts, mentionedCount, citedCount, sentiments } = input

  if (totalPrompts === 0) return 0

  const mentionRate = (mentionedCount / totalPrompts) * 100
  const citationRate = (citedCount / totalPrompts) * 100

  let sentimentScore = 0
  if (sentiments.length > 0) {
    const total = sentiments.reduce((sum, s) => sum + SENTIMENT_SCORES[s], 0)
    sentimentScore = total / sentiments.length
  }

  const score = mentionRate * 0.4 + citationRate * 0.4 + sentimentScore * 0.2

  return Math.round(Math.min(100, Math.max(0, score)))
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest tests/unit/lib/ai-visibility/scorer.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/ai-visibility/scorer.ts tests/unit/lib/ai-visibility/scorer.test.ts
git commit -m "feat: add AI Visibility score calculator"
```

---

### Task 13: Verify everything together

**Step 1: Run full lint + test + build**

Run: `npm run lint && npx vitest run tests/unit && npm run build`
Expected: ALL PASS with no warnings related to new files

**Step 2: Review new file structure**

Run: `find lib/ai-visibility -type f | sort`

Expected:

```
lib/ai-visibility/analyzer.ts
lib/ai-visibility/platforms/chatgpt/adapter.ts
lib/ai-visibility/platforms/claude/adapter.ts
lib/ai-visibility/platforms/perplexity/adapter.ts
lib/ai-visibility/platforms/registry.ts
lib/ai-visibility/platforms/types.ts
lib/ai-visibility/scorer.ts
lib/ai-visibility/sentiment.ts
lib/ai-visibility/types.ts
```

**Step 3: Push**

```bash
git push
```
