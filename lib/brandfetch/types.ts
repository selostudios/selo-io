// Brandfetch API response types

export interface BrandfetchLogo {
  theme: 'dark' | 'light' | null
  type: 'icon' | 'logo' | 'symbol' | 'other'
  formats: BrandfetchFormat[]
}

export interface BrandfetchFormat {
  src: string
  format: string
  height?: number
  width?: number
  size?: number
}

export interface BrandfetchColor {
  hex: string
  type: 'accent' | 'dark' | 'light' | 'brand'
  brightness: number
}

export interface BrandfetchLink {
  name: 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'github' | 'crunchbase'
  url: string
}

export interface BrandfetchCompany {
  employees?: string | null
  foundedYear?: number | null
  kind?: string | null
  location?: {
    city?: string
    country?: string
    countryCode?: string
    region?: string
    state?: string
    subregion?: string
  }
}

export interface BrandfetchResponse {
  id: string
  name: string | null
  domain: string
  claimed: boolean
  description: string | null
  longDescription: string | null
  qualityScore: number
  logos: BrandfetchLogo[]
  colors: BrandfetchColor[]
  fonts: Array<{ name: string | null; type: 'title' | 'body'; origin: string }>
  images: Array<{ type: string; formats: BrandfetchFormat[] }>
  links: BrandfetchLink[]
  company: BrandfetchCompany | null
}

// Normalized brand data for our app
export interface BrandData {
  name: string | null
  description: string | null
  logo: {
    url: string
    format: string
  } | null
  colors: {
    primary: string | null
    secondary: string | null
    accent: string | null
  }
  socialLinks: Array<{ platform: string; url: string }>
  location: {
    city: string | null
    country: string | null
  }
  raw: BrandfetchResponse // Store full response for future use
}
