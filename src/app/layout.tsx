import type { Metadata, Viewport } from "next";
import { AdsenseProvider } from "@/lib/site/adsense-client";
import { parseAdsenseConfig } from "@/lib/site/adsense";
import { GoogleAnalytics } from "@/lib/site/analytics-client";
import { parseGoogleAnalyticsConfig } from "@/lib/site/analytics";
import { resolveSiteConfig } from "@/lib/site/config";
import "./globals.css";

const site = resolveSiteConfig();

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: "Oportunia — Tu próximo paso empieza aquí", template: "%s | Oportunia" },
  description: "Encuentra empleo, prácticas y programas en Perú. Oportunidades claras. Decisiones informadas.",
  openGraph: { locale: "es_PE", type: "website", url: "/", siteName: "Oportunia", title: "Oportunia — Oportunidades claras", description: "Encuentra tu próximo paso en Perú." },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#12377b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const adsense = parseAdsenseConfig();
  const analytics = parseGoogleAnalyticsConfig();
  return <html lang="es-PE"><body><AdsenseProvider config={adsense}>{analytics.enabled ? <GoogleAnalytics config={analytics} /> : null}{children}</AdsenseProvider></body></html>;
}
