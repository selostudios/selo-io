export function generateUTMParameters(campaignName: string) {
  // Convert campaign name to URL-safe format
  const safeName = campaignName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return {
    utm_source: 'selo',
    utm_medium: 'organic',
    utm_campaign: safeName,
    utm_term: '',
    utm_content: '',
  }
}

export function buildUTMUrl(
  baseUrl: string,
  params: {
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    utm_term?: string
    utm_content?: string
  }
) {
  try {
    const url = new URL(baseUrl)

    if (params.utm_source) url.searchParams.set('utm_source', params.utm_source)
    if (params.utm_medium) url.searchParams.set('utm_medium', params.utm_medium)
    if (params.utm_campaign) url.searchParams.set('utm_campaign', params.utm_campaign)
    if (params.utm_term) url.searchParams.set('utm_term', params.utm_term)
    if (params.utm_content) url.searchParams.set('utm_content', params.utm_content)

    return url.toString()
  } catch {
    console.error('[UTM Error] Invalid URL:', baseUrl)
    // Return original URL if parsing fails
    return baseUrl
  }
}
