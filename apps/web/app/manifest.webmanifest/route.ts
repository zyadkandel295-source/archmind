import { NextRequest, NextResponse } from "next/server";

function safeName(value: string | null) {
  const clean = value?.replace(/[^\w\s-]/g, "").trim();
  return clean || "ArchMind Assistant";
}

function safePath(value: string | null) {
  if (!value?.startsWith("/")) return "/dashboard";
  if (value.startsWith("//")) return "/dashboard";
  return value;
}

function safeColor(value: string | null) {
  return /^#[0-9a-fA-F]{6}$/.test(value ?? "") ? value! : "#07111f";
}

export function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const name = safeName(search.get("name"));
  const startUrl = safePath(search.get("start_url"));
  const color = safeColor(search.get("theme_color"));

  return NextResponse.json({
    name,
    short_name: name.slice(0, 12),
    description: `${name} on ArchMind`,
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    background_color: "#030712",
    theme_color: color,
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      }
    ]
  });
}
