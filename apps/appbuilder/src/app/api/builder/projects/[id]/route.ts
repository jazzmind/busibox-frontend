import { NextRequest, NextResponse } from "next/server";

import { requireAuthWithTokenExchange } from "@jazzmind/busibox-app/lib/next/middleware";
import {
  deleteProject,
  ensureDataDocuments,
  getProject,
  updateProjectStatus,
} from "@/lib/data-api-client";
import { runInBuilderSandbox } from "@/lib/builder-sandbox";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "data-api");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const docs = await ensureDataDocuments(auth.apiToken);
    const project = await getProject(auth.apiToken, docs.projects, id);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json({ project });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "data-api");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const docs = await ensureDataDocuments(auth.apiToken);

    await runInBuilderSandbox(
      `set -euo pipefail && supervisorctl stop ${id} || true && rm -f /etc/supervisor/conf.d/${id}.conf && supervisorctl reread && supervisorctl update && rm -rf /srv/projects/${id}`,
      60_000
    );

    await deleteProject(auth.apiToken, docs.projects, id);
    return new Response(null, { status: 204 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "data-api");
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const body = (await request.json()) as { status?: string; lastError?: string | null };
    if (!body.status) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }
    const docs = await ensureDataDocuments(auth.apiToken);
    await updateProjectStatus(auth.apiToken, docs.projects, id, body.status as any, body.lastError);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

