import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://agentia-ai.cloud';
  const now = new Date();

  // Core public routes
  const routes = [
    {
      url: `${baseUrl}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 1.0
    },
    {
      url: `${baseUrl}/ai-base`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.95
    },
    {
      url: `${baseUrl}/ai-base/fundamentals`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.85
    },
    {
      url: `${baseUrl}/ai-base/machine-learning`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.85
    },
    {
      url: `${baseUrl}/ai-base/deep-learning`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.85
    },
    {
      url: `${baseUrl}/ai-base/llms`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.9
    },
    {
      url: `${baseUrl}/ai-base/computer-vision`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.85
    },
    {
      url: `${baseUrl}/ai-base/nlp`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.85
    },
    {
      url: `${baseUrl}/ai-base/agents`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.9
    },
    {
      url: `${baseUrl}/ai-base/math`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8
    },
    {
      url: `${baseUrl}/ai-base/build`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.85
    },
    {
      url: `${baseUrl}/ai-base/research`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.9
    },
    {
      url: `${baseUrl}/ai-base/science`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.85
    },
    {
      url: `${baseUrl}/assistants`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.85
    },
    {
      url: `${baseUrl}/assistants/new`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8
    },
    {
      url: `${baseUrl}/auth/login`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: 0.4
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: 0.4
    }
  ];

  return routes;
}
