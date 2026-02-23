import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, getTokenFromRequest, parseJWTPayload } from "@jazzmind/busibox-app/lib/authz";

import { requireAuthWithTokenExchange } from "@jazzmind/busibox-app/lib/next/middleware";
import {
  createProjectRecord,
  ensureDataDocuments,
  insertProject,
  listProjects,
} from "@/lib/data-api-client";
import { provisionProjectWorkspace, runInBuilderSandbox } from "@/lib/builder-sandbox";
import type { CreateBuilderProjectInput } from "@/lib/types";

const START_PORT = Number(process.env.BUILDER_PORT_START || 4000);
const END_PORT = Number(process.env.BUILDER_PORT_END || 4099);

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "data-api");
    if (auth instanceof NextResponse) return auth;

    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unable to resolve current user." }, { status: 401 });
    }

    const docs = await ensureDataDocuments(auth.apiToken);
    const projects = await listProjects(auth.apiToken, docs.projects, userId);
    return NextResponse.json({ projects });
  } catch (error: unknown) {
    console.error("[Builder Projects] list error:", error);
    const message = error instanceof Error ? error.message : "Failed to list projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "data-api");
    if (auth instanceof NextResponse) return auth;

    const input = (await request.json()) as CreateBuilderProjectInput;
    if (!input?.name?.trim()) {
      return NextResponse.json({ error: "Project name is required." }, { status: 400 });
    }

    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unable to resolve current user." }, { status: 401 });
    }

    const docs = await ensureDataDocuments(auth.apiToken);
    const existing = await listProjects(auth.apiToken, docs.projects, userId);
    const usedPorts = new Set(existing.map((p) => p.devPort));
    const devPort = allocatePort(usedPorts);
    if (devPort === null) {
      return NextResponse.json({ error: "No available builder ports." }, { status: 409 });
    }

    const project = createProjectRecord(input, userId, devPort);
    await insertProject(auth.apiToken, docs.projects, project);

    await provisionProjectWorkspace({
      projectId: project.id,
      appName: project.name,
      routePath: project.routePath,
      devPort: project.devPort,
      templateVariant: project.templateVariant,
    });

    const superviseConf = buildSupervisorConf(project.id, project.devPort);
    const cmd = [
      `set -euo pipefail`,
      `cat <<'EOF' > /etc/supervisor/conf.d/${project.id}.conf`,
      superviseConf,
      `EOF`,
      `supervisorctl reread`,
      `supervisorctl update`,
      `supervisorctl start ${project.id} || true`,
    ].join("\n");
    const startResult = await runInBuilderSandbox(cmd, 120_000);
    if (startResult.exitCode !== 0) {
      return NextResponse.json(
        {
          error: "Workspace provisioned but failed to start dev server.",
          details: startResult.stderr,
          project,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ project }, { status: 201 });
  } catch (error: unknown) {
    console.error("[Builder Projects] create error:", error);
    const message = error instanceof Error ? error.message : "Failed to create project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getUserId(request: NextRequest): string | null {
  const session = getSessionFromRequest(request);
  if (session?.userId) return session.userId;

  const token = getTokenFromRequest(request);
  if (!token) return null;
  const payload = parseJWTPayload(token);
  if (!payload) return null;
  const userId =
    (typeof payload.sub === "string" && payload.sub) ||
    (typeof payload.user_id === "string" && payload.user_id) ||
    (typeof payload.userId === "string" && payload.userId) ||
    null;
  return userId;
}

function allocatePort(usedPorts: Set<number>): number | null {
  for (let port = START_PORT; port <= END_PORT; port++) {
    if (!usedPorts.has(port)) return port;
  }
  return null;
}

function buildSupervisorConf(projectId: string, port: number): string {
  return `[program:${projectId}]
command=/bin/bash -lc 'cd /srv/projects/${projectId} && PORT=${port} npm run dev -- --port ${port}'
directory=/srv/projects/${projectId}
autostart=true
autorestart=true
startretries=5
startsecs=10
stdout_logfile=/var/log/builder/${projectId}.log
stdout_logfile_maxbytes=0
stderr_logfile=/var/log/builder/${projectId}.err.log
stderr_logfile_maxbytes=0
`;
}

