import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://agentia-ai.cloud';

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/ai-base',
          '/ai-base/*',
          '/assistants',
          '/assistants/*',
          '/auth/login',
          '/privacy',
          '/terms'
        ],
        disallow: [
          '/admin',
          '/admin/*',
          '/analytics',
          '/dashboard',
          '/profile',
          '/settings',
          '/api/*',
          '/_next/*',
          '/auth/notion/callback'
        ]
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/admin/*', '/api/*']
      }
    ],
    sitemap: `${baseUrl}/sitemap.xml`
  };
}
