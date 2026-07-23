import type { Metadata } from "next";
import "highlight.js/styles/github-dark.css";
import "./globals.css";
import { AppChrome } from "@/components/app-chrome";
import { ActivityTracker } from "@/components/activity-tracker";

export const metadata: Metadata = {
  title: "ArchMind",
  description: "Build, deploy, and manage custom AI assistants with streaming chat and knowledge-backed answers.",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/icon.svg", type: "image/svg+xml" }]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ActivityTracker />
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
