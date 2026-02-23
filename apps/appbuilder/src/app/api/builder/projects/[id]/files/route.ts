import { NextRequest, NextResponse } from "next/server";

import { requireAuthWithTokenExchange } from "@jazzmind/busibox-app/lib/next/middleware";
import { listProjectFiles } from "@/lib/builder-sandbox";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "data-api");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const files = await listProjectFiles(id);
    return NextResponse.json({ files });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to list files";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

