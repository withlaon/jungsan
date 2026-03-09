import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = 'https://jungsan-time.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/terms'],
        disallow: [
          '/dashboard',
          '/site-admin',
          '/login',
          '/signup',
          '/api/',
          '/rider/',
          '/(admin)/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
