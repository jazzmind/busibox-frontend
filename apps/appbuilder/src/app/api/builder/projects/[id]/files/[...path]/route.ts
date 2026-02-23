import { NextRequest, NextResponse } from "next/server";

import { requireAuthWithTokenExchange } from "@jazzmind/busibox-app/lib/next/middleware";
import { readProjectFile } from "@/lib/builder-sandbox";

interface RouteParams {
  params: Promise<{ id: string; path: string[] }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "data-api");
    if (auth instanceof NextResponse) return auth;

    const { id, path } = await params;
    const filePath = path.join("/");
    const contents = await readProjectFile(id, filePath);
    return NextResponse.json({ path: filePath, contents });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to read file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

