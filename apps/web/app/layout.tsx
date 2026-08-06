import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "AGENTIA - AI Agent Workspace & System Automation Platform",
  description: "AGENTIA is an AI agent workspace platform where users sign in with Google to create, customize, and deploy AI assistants that execute automated workflows securely.",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/archmind-icon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={inter.className}>
        <DataPersistenceProvider>
          <ActivityTracker />
          <AppChrome>{children}</AppChrome>
        </DataPersistenceProvider>
      </body>
    </html>
  );
}
