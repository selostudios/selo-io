import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54321',
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
      {
        source: '/seo/reports',
        destination: '/seo/client-reports',
        permanent: true,
      },
      {
        source: '/seo/reports/:path*',
        destination: '/seo/client-reports/:path*',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
