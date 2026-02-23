import { NextRequest, NextResponse } from "next/server";

interface LibraryManifest {
  name?: string;
  description?: string;
  tags?: string[];
  repo?: string | null;
}

const LIBRARY_OWNER = process.env.BUILDER_LIBRARY_OWNER || "jazzmind";
const LIBRARY_REPO = process.env.BUILDER_LIBRARY_REPO || "busibox-app-library";

export async function GET(_request: NextRequest) {
  try {
    const treeUrl = `https://api.github.com/repos/${LIBRARY_OWNER}/${LIBRARY_REPO}/git/trees/main?recursive=1`;
    const treeRes = await fetch(treeUrl, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
    });
    if (!treeRes.ok) {
      const details = await treeRes.text();
      return NextResponse.json({ error: "Failed to load library tree", details }, { status: treeRes.status });
    }

    const treeJson = (await treeRes.json()) as {
      tree: Array<{ path: string; type: string; url: string }>;
    };

    const manifests = treeJson.tree.filter(
      (entry) => entry.type === "blob" && entry.path.startsWith("apps/") && entry.path.endsWith("/manifest.json")
    );

    const apps = await Promise.all(
      manifests.map(async (entry) => {
        const manifestRes = await fetch(entry.url, {
          headers: { Accept: "application/vnd.github.raw+json" },
          next: { revalidate: 3600 },
        });
        if (!manifestRes.ok) {
          return null;
        }
        const manifest = (await manifestRes.json()) as LibraryManifest;
        const slug = entry.path.split("/")[1];
        return {
          slug,
          name: manifest.name || slug,
          description: manifest.description || "",
          tags: manifest.tags || [],
          repo: manifest.repo || null,
        };
      })
    );

    return NextResponse.json({ apps: apps.filter(Boolean) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load app library";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

