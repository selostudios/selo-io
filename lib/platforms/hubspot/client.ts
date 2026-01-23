// lib/platforms/hubspot/client.ts
import type {
  HubSpotCredentials,
  HubSpotMetrics,
  HubSpotCRMMetrics,
  HubSpotMarketingMetrics,
} from './types'
import { getOAuthProvider } from '@/lib/oauth/registry'
import { Platform } from '@/lib/oauth/types'
import type { OAuthProvider } from '@/lib/oauth/base'

const HUBSPOT_API_BASE = 'https://api.hubapi.com'

export class HubSpotClient {
  private accessToken: string
  private credentials: HubSpotCredentials
  private connectionId: string | null
  private oauthProvider: OAuthProvider | null
  // Cache marketing metrics since they don't change between period fetches
  private marketingMetricsCache: HubSpotMarketingMetrics | null = null

  constructor(credentials: HubSpotCredentials, connectionId?: string) {
    this.credentials = credentials
    this.accessToken = credentials.access_token
    this.connectionId = connectionId || null
    this.oauthProvider =
      connectionId && credentials.refresh_token ? getOAuthProvider(Platform.HUBSPOT) : null
  }

  private async ensureFreshToken(): Promise<void> {
    if (!this.oauthProvider || !this.connectionId) {
      return
    }

    if (this.oauthProvider.shouldRefreshToken(this.credentials.expires_at)) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[HubSpot Client] Refreshing token', {
          expiresAt: this.credentials.expires_at,
          connectionId: this.connectionId,
        })
      }

      try {
        const newTokens = await this.oauthProvider.refreshAccessToken(
          this.credentials.refresh_token
        )
        await this.oauthProvider.updateTokensInDatabase(this.connectionId, newTokens)

        this.credentials = {
          ...this.credentials,
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expires_at: this.oauthProvider.calculateExpiresAt(newTokens.expires_in),
        }
        this.accessToken = newTokens.access_token

        if (process.env.NODE_ENV === 'development') {
          console.log('[HubSpot Client] Token refreshed successfully')
        }
      } catch (error) {
        console.error('[HubSpot Client] Token refresh failed', {
          type: 'token_refresh_error',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        })

        if (this.connectionId) {
          try {
            const { createClient } = await import('@/lib/supabase/server')
            const supabase = await createClient()
            await supabase
              .from('platform_connections')
              .update({ status: 'failed' })
              .eq('id', this.connectionId)
          } catch {
            console.error('[HubSpot Client] Failed to update connection status')
          }
        }

        throw error
      }
    }
  }

  private async fetch<T>(endpoint: string, silent = false): Promise<T> {
    await this.ensureFreshToken()

    const url = `${HUBSPOT_API_BASE}${endpoint}`
    if (!silent && process.env.NODE_ENV === 'development') {
      console.log('[HubSpot Client] API request:', { url })
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('[HubSpot Client] API error:', {
        status: response.status,
        url,
        errorBody,
      })
      throw new Error(this.formatError(response.status, errorBody))
    }

    return response.json()
  }

  private formatError(status: number, body: string): string {
    switch (status) {
      case 401:
        return 'HubSpot token expired or invalid. Please reconnect your account.'
      case 403:
        return 'HubSpot access denied. Please check your permissions.'
      case 429:
        return 'HubSpot rate limit exceeded. Please try again later.'
      default:
        try {
          const parsed = JSON.parse(body)
          return parsed.message || `HubSpot error: ${body}`
        } catch {
          return `HubSpot error (${status}): ${body}`
        }
    }
  }

  private async postSearch<T>(endpoint: string, body: object): Promise<T> {
    await this.ensureFreshToken()

    const url = `${HUBSPOT_API_BASE}${endpoint}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(this.formatError(response.status, errorBody))
    }

    return response.json()
  }

  async getCRMMetrics(
    startDate?: Date,
    endDate?: Date,
    days: number = 30
  ): Promise<HubSpotCRMMetrics> {
    const emptyMetrics: HubSpotCRMMetrics = {
      totalContacts: 0,
      totalDeals: 0,
      newDeals: 0,
      totalPipelineValue: 0,
      dealsWon: 0,
      dealsLost: 0,
    }

    try {
      // Calculate date range for "new deals" filter
      let filterStartDate: Date
      let filterEndDate: Date | undefined

      if (startDate && endDate) {
        filterStartDate = startDate
        filterEndDate = endDate
      } else {
        filterStartDate = new Date()
        filterStartDate.setDate(filterStartDate.getDate() - days)
      }
      const startDateMs = filterStartDate.getTime()
      const endDateMs = filterEndDate?.getTime()

      // Use search API to get total counts (list API doesn't return totals)
      const [contactsResponse, dealsResponse, newDealsResponse] = await Promise.all([
        this.postSearch<{ total: number }>('/crm/v3/objects/contacts/search', {
          filterGroups: [],
          limit: 1,
        }),
        this.postSearch<{
          total: number
          results: Array<{
            properties: {
              amount?: string
              dealstage?: string
            }
          }>
        }>('/crm/v3/objects/deals/search', {
          filterGroups: [],
          properties: ['amount', 'dealstage'],
          limit: 100,
        }),
        // Get deals created in the selected period
        this.postSearch<{ total: number }>('/crm/v3/objects/deals/search', {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'createdate',
                  operator: 'GTE',
                  value: startDateMs.toString(),
                },
                ...(endDateMs
                  ? [
                      {
                        propertyName: 'createdate',
                        operator: 'LTE' as const,
                        value: endDateMs.toString(),
                      },
                    ]
                  : []),
              ],
            },
          ],
          limit: 1,
        }),
      ])

      let totalPipelineValue = 0
      let dealsWon = 0
      let dealsLost = 0

      for (const deal of dealsResponse.results || []) {
        const amount = parseFloat(deal.properties.amount || '0') || 0
        totalPipelineValue += amount

        const stage = deal.properties.dealstage?.toLowerCase() || ''
        if (stage.includes('won') || stage === 'closedwon') {
          dealsWon++
        } else if (stage.includes('lost') || stage === 'closedlost') {
          dealsLost++
        }
      }

      const metrics: HubSpotCRMMetrics = {
        totalContacts: contactsResponse.total || 0,
        totalDeals: dealsResponse.total || 0,
        newDeals: newDealsResponse.total || 0,
        totalPipelineValue,
        dealsWon,
        dealsLost,
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('[HubSpot Client] CRM metrics:', metrics)
      }
      return metrics
    } catch (error) {
      console.error('[HubSpot Client] CRM metrics error:', error)
      return emptyMetrics
    }
  }

  async getMarketingMetrics(): Promise<HubSpotMarketingMetrics> {
    // Return cached result if available (marketing metrics don't change between period fetches)
    if (this.marketingMetricsCache) {
      return this.marketingMetricsCache
    }

    const emptyMetrics: HubSpotMarketingMetrics = {
      emailsSent: 0,
      emailsOpened: 0,
      emailsClicked: 0,
      openRate: 0,
      clickRate: 0,
      formSubmissions: 0,
    }

    try {
      // Get marketing email statistics
      // Note: This endpoint may require marketing hub subscription
      let emailsSent = 0
      let emailsOpened = 0
      let emailsClicked = 0

      try {
        const emailsResponse = await this.fetch<{
          objects: Array<{
            stats: {
              counters: {
                sent?: number
                open?: number
                click?: number
              }
            }
          }>
        }>('/marketing-emails/v1/emails/with-statistics?limit=100')

        for (const email of emailsResponse.objects || []) {
          emailsSent += email.stats?.counters?.sent || 0
          emailsOpened += email.stats?.counters?.open || 0
          emailsClicked += email.stats?.counters?.click || 0
        }
      } catch (emailError) {
        console.log('[HubSpot Client] Marketing emails not available:', emailError)
      }

      // Get form submissions count - batched to avoid rate limits
      let formSubmissions = 0
      try {
        const formsResponse = await this.fetch<Array<{ guid: string }>>('/forms/v2/forms')
        const forms = formsResponse || []

        if (forms.length > 0) {
          // Process forms in batches of 5 to avoid rate limits
          const BATCH_SIZE = 5
          const batches: Array<{ guid: string }>[] = []
          for (let i = 0; i < forms.length; i += BATCH_SIZE) {
            batches.push(forms.slice(i, i + BATCH_SIZE))
          }

          for (const batch of batches) {
            const submissionPromises = batch.map((form) =>
              this.fetch<{ totalCount: number }>(
                `/form-integrations/v1/submissions/forms/${form.guid}?limit=1`,
                true // silent - don't log each form request
              ).catch(() => ({ totalCount: 0 }))
            )
            const results = await Promise.all(submissionPromises)
            formSubmissions += results.reduce((sum, r) => sum + (r.totalCount || 0), 0)
          }
        }
      } catch (formsError) {
        console.log('[HubSpot Client] Forms not available:', formsError)
      }

      const openRate = emailsSent > 0 ? (emailsOpened / emailsSent) * 100 : 0
      const clickRate = emailsSent > 0 ? (emailsClicked / emailsSent) * 100 : 0

      const metrics: HubSpotMarketingMetrics = {
        emailsSent,
        emailsOpened,
        emailsClicked,
        openRate: Math.round(openRate * 100) / 100,
        clickRate: Math.round(clickRate * 100) / 100,
        formSubmissions,
      }

      // Cache the result
      this.marketingMetricsCache = metrics

      if (process.env.NODE_ENV === 'development') {
        console.log('[HubSpot Client] Marketing metrics:', metrics)
      }
      return metrics
    } catch (error) {
      console.error('[HubSpot Client] Marketing metrics error:', error)
      return emptyMetrics
    }
  }

  async getMetrics(startDate?: Date, endDate?: Date, days: number = 30): Promise<HubSpotMetrics> {
    const [crm, marketing] = await Promise.all([
      this.getCRMMetrics(startDate, endDate, days),
      this.getMarketingMetrics(),
    ])

    return { crm, marketing }
  }
}
