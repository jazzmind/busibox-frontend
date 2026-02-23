import { NextRequest, NextResponse } from "next/server";

import { requireAuthWithTokenExchange } from "@jazzmind/busibox-app/lib/next/middleware";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "agent-api");
    if (auth instanceof NextResponse) return auth;

    return NextResponse.json({ token: auth.apiToken });
  } catch (error) {
    console.error("[Auth Token] Error:", error);
    return NextResponse.json({ error: "Failed to get token" }, { status: 500 });
  }
}

