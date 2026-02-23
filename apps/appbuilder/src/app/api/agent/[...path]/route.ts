import { NextRequest, NextResponse } from "next/server";

import { getApiToken } from "@jazzmind/busibox-app/lib/authz/next-client";

const AGENT_API_URL = process.env.AGENT_API_URL || "http://agent-api:8000";

async function forwardRequest(
  request: NextRequest,
  method: string,
  path: string[],
  token: string
) {
  const targetPath = path.join("/");
  const url = new URL(`${AGENT_API_URL}/${targetPath}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  let body: string | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const contentType = request.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(await request.json());
    }
  }

  const response = await fetch(url.toString(), { method, headers, body });
  const contentType = response.headers.get("Content-Type") || "";
  const isStream = contentType.includes("text/event-stream");

  if (isStream) {
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  if (response.status === 204) return new Response(null, { status: 204 });

  const text = await response.text();
  try {
    return NextResponse.json(JSON.parse(text), { status: response.status });
  } catch {
    return new Response(text, { status: response.status });
  }
}

async function proxy(request: NextRequest, method: string, path: string[]) {
  try {
    const sessionCookie = request.cookies.get("busibox-session");
    const sessionJwt = sessionCookie?.value || process.env.TEST_SESSION_JWT;
    if (!sessionJwt) {
      return NextResponse.json(
        { error: "Authentication required", message: "Missing busibox-session cookie." },
        { status: 401 }
      );
    }

    const token = await getApiToken(sessionJwt, "agent-api");
    return await forwardRequest(request, method, path, token);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Agent proxy failed";
    console.error("[Agent Proxy] Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxy(request, "GET", path);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxy(request, "POST", path);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxy(request, "PUT", path);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxy(request, "PATCH", path);
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxy(request, "DELETE", path);
}

