"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface LibraryApp {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  repo: string | null;
}

export default function LibraryPage() {
  const [apps, setApps] = useState<LibraryApp[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadLibrary() {
      try {
        const response = await fetch("/api/library/apps");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load library");
        if (!cancelled) setApps(data.apps || []);
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load library");
      }
    }
    loadLibrary();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to Builder
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">App Library</h1>
      </div>

      {error && <div className="text-sm text-red-500">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {apps.map((app) => (
          <article
            key={app.slug}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{app.name}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{app.description}</p>
            <div className="mt-3 flex gap-2 flex-wrap">
              {app.tags.map((tag) => (
                <span
                  key={`${app.slug}-${tag}`}
                  className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800"
                >
                  {tag}
                </span>
              ))}
            </div>
            {app.repo && (
              <a
                href={`https://github.com/${app.repo}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {app.repo}
              </a>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

