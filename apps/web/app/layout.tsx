import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "highlight.js/styles/github-dark.css";
import "./globals.css";
import { AppChrome } from "@/components/app-chrome";
import { ActivityTracker } from "@/components/activity-tracker";
import { DataPersistenceProvider } from "@/lib/context/data-persistence-context";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter"
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agentia-ai.cloud";

export const viewport: Viewport = {
  themeColor: "#EFE3D2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "light"
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AGÈNTIA - Autonomous AI Agents, System Automation & AI Base",
    template: "%s | AGÈNTIA"
  },
  description:
    "AGÈNTIA is the next-generation autonomous AI agent workspace and comprehensive technical AI knowledge base. Build, customize, research, and deploy secure AI assistants.",
  keywords: [
    "AI agents",
    "autonomous AI",
    "AI assistants",
    "machine learning",
    "deep learning",
    "large language models",
    "LLM fine-tuning",
    "AI knowledge base",
    "AI automation",
    "agentic AI",
    "PyTorch",
    "Transformers",
    "computer vision",
    "NLP"
  ],
  authors: [{ name: "AGÈNTIA Team", url: siteUrl }],
  creator: "AGÈNTIA",
  publisher: "AGÈNTIA AI",
  category: "Technology",
  formatDetection: {
    email: false,
    address: false,
    telephone: false
  },
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "AGÈNTIA - Autonomous AI Agents, System Automation & AI Base",
    description:
      "Build, customize, research, and deploy autonomous AI assistants with knowledge retrieval, tool automation, and technical AI research.",
    url: siteUrl,
    siteName: "AGÈNTIA",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/icon.svg",
        width: 1200,
        height: 630,
        alt: "AGÈNTIA - Autonomous AI Platform"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "AGÈNTIA - Autonomous AI Platform & Knowledge Base",
    description: "Next-generation AI agent builder and interactive technical AI knowledge platform.",
    creator: "@agentia_ai",
    images: ["/icon.svg"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/archmind-icon.svg", type: "image/svg+xml" }
    ],
    shortcut: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }]
  }
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      "url": siteUrl,
      "name": "AGÈNTIA",
      "description": "Autonomous AI Agent Platform & Comprehensive AI Knowledge Base",
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": `${siteUrl}/ai-base?q={search_term_string}`
        },
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      "name": "AGÈNTIA",
      "url": siteUrl,
      "logo": `${siteUrl}/icon.svg`,
      "sameAs": [
        "https://github.com/agentia",
        "https://twitter.com/agentia_ai"
      ]
    },
    {
      "@type": "SoftwareApplication",
      "name": "AGÈNTIA Platform",
      "operatingSystem": "All",
      "applicationCategory": "BusinessApplication",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      }
    }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={inter.className}>
        <DataPersistenceProvider>
          <ActivityTracker />
          <AppChrome>{children}</AppChrome>
        </DataPersistenceProvider>
      </body>
    </html>
  );
}
