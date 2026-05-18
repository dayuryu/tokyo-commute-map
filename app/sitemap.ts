import type { MetadataRoute } from 'next'
import { DESTINATIONS_META } from '@/lib/destinations'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://kayoha.com'
  const now = new Date()

  const core: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${base}/legal`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/legal/commerce`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/legal/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/legal/ads`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/legal/contact`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  const destinations: MetadataRoute.Sitemap = DESTINATIONS_META.map(m => ({
    url: `${base}/to/${m.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  return [...core, ...destinations]
}
