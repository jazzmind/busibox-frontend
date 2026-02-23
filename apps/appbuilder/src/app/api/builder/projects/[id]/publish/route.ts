import { NextRequest, NextResponse } from "next/server";

import { requireAuthWithTokenExchange } from "@jazzmind/busibox-app/lib/next/middleware";
import { runInBuilderSandbox } from "@/lib/builder-sandbox";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface PublishBody {
  githubToken?: string;
  libraryOwner?: string;
  libraryRepo?: string;
  appSlug?: string;
  description?: string;
  tags?: string[];
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
      if (typeof data.github_pat === "string" && data.github_pat) return data.github_pat;
    }
  } catch {
    // ignore and fallback
  }
  return process.env.GITHUB_AUTH_TOKEN || null;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "data-api");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = (await request.json()) as PublishBody;
    const token = await resolveGithubToken(auth.sessionJwt, body.githubToken);
    if (!token) {
      return NextResponse.json(
        { error: "Missing GitHub token. Provide githubToken in request body." },
        { status: 400 }
      );
    }

    const libraryOwner = body.libraryOwner || process.env.BUILDER_LIBRARY_OWNER || "jazzmind";
    const libraryRepo = body.libraryRepo || process.env.BUILDER_LIBRARY_REPO || "busibox-app-library";
    const appSlug = body.appSlug || id;

    const manifestRaw = await runInBuilderSandbox(`cat /srv/projects/${id}/busibox.json`, 30_000);
    if (manifestRaw.exitCode !== 0) {
      return NextResponse.json({ error: "Project manifest not found." }, { status: 400 });
    }
    const manifest = JSON.parse(manifestRaw.stdout);

    const prBranch = `publish-${appSlug}-${Date.now()}`;
    const manifestFile = JSON.stringify(
      {
        name: manifest.name,
        description: body.description || manifest.description || "",
        author: "busibox-user",
        repo: manifest.githubRepo || null,
        version: manifest.version || "0.1.0",
        tags: body.tags || ["busibox"],
        appMode: manifest.appMode || "frontend",
        requiresDatabase: Boolean(manifest.database?.required),
      },
      null,
      2
    );

    const cmd = [
      `set -euo pipefail`,
      `tmpdir="/tmp/library-${id}"`,
      `rm -rf "$tmpdir"`,
      `git clone "https://x-access-token:${token}@github.com/${libraryOwner}/${libraryRepo}.git" "$tmpdir"`,
      `cd "$tmpdir"`,
      `git checkout -b "${prBranch}"`,
      `mkdir -p "apps/${appSlug}"`,
      `cat <<'EOF' > "apps/${appSlug}/manifest.json"`,
      manifestFile,
      `EOF`,
      `cat <<'EOF' > "apps/${appSlug}/README.md"`,
      `# ${manifest.name}`,
      ``,
      `${body.description || manifest.description || "Published from Busibox App Builder."}`,
      `EOF`,
      `git add "apps/${appSlug}/manifest.json" "apps/${appSlug}/README.md"`,
      `git commit -m "feat: publish ${appSlug} to library"`,
      `git push -u origin "${prBranch}"`,
    ].join("\n");

    const push = await runInBuilderSandbox(cmd, 180_000);
    if (push.exitCode !== 0) {
      return NextResponse.json(
        { error: "Failed to publish branch to library repository.", details: push.stderr },
        { status: 500 }
      );
    }

    const prRes = await fetch(`https://api.github.com/repos/${libraryOwner}/${libraryRepo}/pulls`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: `Publish ${manifest.name}`,
        head: prBranch,
        base: "main",
        body: `Published from Busibox App Builder project \`${id}\`.`,
      }),
    });

    if (!prRes.ok) {
      const details = await prRes.text();
      return NextResponse.json(
        { error: "Branch pushed but PR creation failed.", details, branch: prBranch },
        { status: prRes.status }
      );
    }

    const pr = await prRes.json();
    return NextResponse.json({ ok: true, prUrl: pr.html_url, branch: prBranch });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to publish project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

