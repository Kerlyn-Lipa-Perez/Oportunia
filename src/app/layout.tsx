import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: "Oportunia — Tu próximo paso empieza aquí", template: "%s | Oportunia" },
  description: "Encuentra empleo, prácticas y programas en Perú. Oportunidades claras. Decisiones informadas.",
  openGraph: { locale: "es_PE", type: "website", siteName: "Oportunia", title: "Oportunia — Oportunidades claras", description: "Encuentra tu próximo paso en Perú." },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#12377b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-PE"><body>{children}</body></html>;
}
