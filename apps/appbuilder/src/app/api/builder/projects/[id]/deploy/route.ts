import { NextRequest, NextResponse } from "next/server";

import { requireAuthWithTokenExchange } from "@jazzmind/busibox-app/lib/next/middleware";
import { ensureDataDocuments, getProject, updateProjectStatus } from "@/lib/data-api-client";
import { runInBuilderSandbox } from "@/lib/builder-sandbox";

const DEPLOY_API_URL = process.env.DEPLOY_API_URL || "http://deploy-api:8011";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "data-api");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const docs = await ensureDataDocuments(auth.apiToken);
    const project = await getProject(auth.apiToken, docs.projects, id);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    await updateProjectStatus(auth.apiToken, docs.projects, id, "deploying");

    const manifestResult = await runInBuilderSandbox(
      `set -euo pipefail && cat /srv/projects/${id}/busibox.json`,
      30_000
    );
    if (manifestResult.exitCode !== 0) {
      await updateProjectStatus(
        auth.apiToken,
        docs.projects,
        id,
        "failed",
        manifestResult.stderr || "Unable to read manifest"
      );
      return NextResponse.json({ error: "Unable to read project manifest." }, { status: 500 });
    }

    const manifest = JSON.parse(manifestResult.stdout);
    const deployRes = await fetch(`${DEPLOY_API_URL}/api/v1/deployment/deploy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.sessionJwt ?? ""}`,
      },
      body: JSON.stringify({
        manifest: {
          ...manifest,
          id: project.id,
          name: project.name,
          defaultPath: project.routePath,
          defaultPort: project.devPort,
        },
        config: {
          environment: "production",
          localDevDir: id,
          useLocalDevDir: true,
        },
      }),
    });

    if (!deployRes.ok) {
      const body = await deployRes.text();
      await updateProjectStatus(auth.apiToken, docs.projects, id, "failed", body);
      return NextResponse.json({ error: "Deploy API request failed.", details: body }, { status: deployRes.status });
    }

    const deployment = await deployRes.json();
    await updateProjectStatus(auth.apiToken, docs.projects, id, "deployed");
    return NextResponse.json({ deployment });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to deploy project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

