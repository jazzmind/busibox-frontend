import { NextRequest, NextResponse } from "next/server";

import { requireAuthWithTokenExchange } from "@jazzmind/busibox-app/lib/next/middleware";
import { runInBuilderSandbox } from "@/lib/builder-sandbox";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "data-api");
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;

    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        const encoder = new TextEncoder();
        for (let i = 0; i < 20; i++) {
          if (closed) break;
          const result = await runInBuilderSandbox(
            `set -euo pipefail && tail -n 120 /var/log/builder/${id}.log 2>/dev/null || true`,
            10_000
          );
          const payload = JSON.stringify({
            timestamp: new Date().toISOString(),
            output: result.stdout || "",
            error: result.stderr || "",
          });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        controller.close();
      },
      cancel() {},
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to stream logs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

