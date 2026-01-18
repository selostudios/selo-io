// lib/platforms/hubspot/types.ts

export interface HubSpotCredentials {
  access_token: string
  refresh_token: string
  expires_at: string
  hub_id: string
  hub_domain: string
}

export interface HubSpotCRMMetrics {
  totalContacts: number
  totalDeals: number
  newDeals: number
  totalPipelineValue: number
  dealsWon: number
  dealsLost: number
}

export interface HubSpotMarketingMetrics {
  emailsSent: number
  emailsOpened: number
  emailsClicked: number
  openRate: number
  clickRate: number
  formSubmissions: number
}

export interface HubSpotMetrics {
  crm: HubSpotCRMMetrics
  marketing: HubSpotMarketingMetrics
}
