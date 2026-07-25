import type { Metadata } from "next";
import "highlight.js/styles/github-dark.css";
import "./globals.css";
import { AppChrome } from "@/components/app-chrome";
import { ActivityTracker } from "@/components/activity-tracker";
import { DataPersistenceProvider } from "@/lib/context/data-persistence-context";

export const metadata: Metadata = {
  title: "AGENTIA - Deploy AI Agents",
  description: "Deploy intelligent agents powered by PHOENIX 1.0",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/archmind-icon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DataPersistenceProvider>
          <ActivityTracker />
          <AppChrome>{children}</AppChrome>
        </DataPersistenceProvider>
      </body>
    </html>
  );
}
