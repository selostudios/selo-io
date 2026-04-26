import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/sign/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54321',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54321',
        pathname: '/storage/v1/object/sign/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
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
        destination: '/reports/audit',
        permanent: true,
      },
      {
        source: '/seo/reports/:path*',
        destination: '/reports/audit/:path*',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
