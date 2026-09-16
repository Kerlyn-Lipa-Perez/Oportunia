import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const hostname = new URL(base).hostname;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  if (process.env.NODE_ENV !== 'production' || local) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
    sitemap: `${base}/sitemap.xml`,
  };
}
