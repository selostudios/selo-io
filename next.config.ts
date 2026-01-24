import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/audit',
        destination: '/seo/site-audit',
        permanent: true,
      },
      {
        source: '/audit/performance',
        destination: '/seo/page-speed',
        permanent: true,
      },
      {
        source: '/audit/:id',
        destination: '/seo/site-audit/:id',
        permanent: true,
      },
      {
        source: '/audit/performance/:id',
        destination: '/seo/page-speed/:id',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
