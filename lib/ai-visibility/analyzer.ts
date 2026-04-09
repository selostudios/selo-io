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
