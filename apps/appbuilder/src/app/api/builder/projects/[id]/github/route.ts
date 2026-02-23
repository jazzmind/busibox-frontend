import { NextRequest, NextResponse } from "next/server";

import { requireAuthWithTokenExchange } from "@jazzmind/busibox-app/lib/next/middleware";
import { runInBuilderSandbox } from "@/lib/builder-sandbox";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface GithubRequestBody {
  action: "init" | "push" | "pull";
  repoOwner?: string;
  repoName?: string;
  visibility?: "public" | "private";
  githubToken?: string;
  commitMessage?: string;
}

async function resolveGithubToken(sessionJwt: string | null, bodyToken?: string): Promise<string | null> {
  if (bodyToken) return bodyToken;
  const authzBase = process.env.AUTHZ_BASE_URL || "http://authz-api:8010";
  if (!sessionJwt) return process.env.GITHUB_AUTH_TOKEN || null;

  try {
    const res = await fetch(`${authzBase}/me/github-pat`, {
      headers: { Authorization: `Bearer ${sessionJwt}` },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.github_pat === "string" && data.github_pat) {
        return data.github_pat;
      }
    }
  } catch {
    // fall through
  }
  return process.env.GITHUB_AUTH_TOKEN || null;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "data-api");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = (await request.json()) as GithubRequestBody;
    const token = await resolveGithubToken(auth.sessionJwt, body.githubToken);

    if (!token) {
      return NextResponse.json(
        { error: "Missing GitHub token. Provide githubToken in request body." },
        { status: 400 }
      );
    }

    if (body.action === "init") {
      if (!body.repoOwner || !body.repoName) {
        return NextResponse.json(
          { error: "repoOwner and repoName are required for init." },
          { status: 400 }
        );
      }
      const remote = `https://x-access-token:${token}@github.com/${body.repoOwner}/${body.repoName}.git`;
      const initCmd = [
        `set -euo pipefail`,
        `cd /srv/projects/${id}`,
        `git init`,
        `git checkout -B main`,
        `git remote remove origin || true`,
        `git remote add origin "${remote}"`,
      ].join("\n");
      const result = await runInBuilderSandbox(initCmd, 60_000);
      if (result.exitCode !== 0) {
        return NextResponse.json({ error: result.stderr || "Failed to initialize git." }, { status: 500 });
      }
      return NextResponse.json({ ok: true, action: "init" });
    }

    if (body.action === "push") {
      const commitMessage = body.commitMessage || "chore: sync builder changes";
      const pushCmd = [
        `set -euo pipefail`,
        `cd /srv/projects/${id}`,
        `git add .`,
        `git commit -m "${commitMessage.replace(/"/g, '\\"')}" || true`,
        `git push -u origin main`,
      ].join("\n");
      const result = await runInBuilderSandbox(pushCmd, 120_000);
      if (result.exitCode !== 0) {
        return NextResponse.json({ error: result.stderr || "Failed to push changes." }, { status: 500 });
      }
      return NextResponse.json({ ok: true, action: "push", output: result.stdout });
    }

    if (body.action === "pull") {
      const pullCmd = `set -euo pipefail && cd /srv/projects/${id} && git pull --rebase origin main`;
      const result = await runInBuilderSandbox(pullCmd, 120_000);
      if (result.exitCode !== 0) {
        return NextResponse.json({ error: result.stderr || "Failed to pull changes." }, { status: 500 });
      }
      return NextResponse.json({ ok: true, action: "pull", output: result.stdout });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "GitHub operation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

