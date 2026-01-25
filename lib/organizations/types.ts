export type OrganizationStatus = 'prospect' | 'customer' | 'inactive'

export interface Industry {
  id: string
  name: string
}

export interface Organization {
  id: string
  name: string
  website_url: string | null
  status: OrganizationStatus
  industry: string | null
  contact_email: string | null
  contact_info: Record<string, unknown> | null
  logo_url: string | null
  primary_color: string | null
  secondary_color: string | null
  accent_color: string | null
  created_at: string
  updated_at: string
}

export interface OrganizationForSelector {
  id: string
  name: string
  website_url: string | null
  status: OrganizationStatus
}

export interface CreateOrganizationInput {
  name: string
  websiteUrl: string
}

export interface ConvertToCustomerInput {
  organizationId: string
  industry: string
  contactEmail: string
}
