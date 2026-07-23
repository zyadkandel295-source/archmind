import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const activityData = await req.json();
    const apiBase = process.env.NEXT_PUBLIC_PLATFORM_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
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
    });

    const data = await backendResponse.json();
    return NextResponse.json(data, { status: backendResponse.status });
  } catch (error: any) {
    console.error("[Proxy Activity Error]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
