import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const activityData = await req.json().catch(() => ({}));
    const apiBase = (process.env.NEXT_PUBLIC_PLATFORM_URL || process.env.NEXT_PUBLIC_API_URL || "https://archmind-api.vercel.app").replace(/\/$/, "");
    const backendUrl = `${apiBase}/api/site-activity`;

    const authHeader = req.headers.get("authorization");

    const backendResponse = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      },
      body: JSON.stringify(activityData),
      cache: "no-store"
    }).catch(() => null);

    if (!backendResponse || !backendResponse.ok) {
      return NextResponse.json({ recorded: true, fallback: true }, { status: 200 });
    }

    const data = await backendResponse.json().catch(() => ({ recorded: true }));
    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json({ recorded: true }, { status: 200 });
  }
}
