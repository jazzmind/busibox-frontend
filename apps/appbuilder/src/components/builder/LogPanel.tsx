"use client";

import { useEffect, useMemo, useState } from "react";

interface LogPanelProps {
  projectId: string;
}

export function LogPanel({ projectId }: LogPanelProps) {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const source = new EventSource(`/api/builder/projects/${projectId}/logs`);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { output?: string; error?: string };
        const merged = [payload.output || "", payload.error || ""]
          .join("\n")
          .split("\n")
          .filter(Boolean);
        if (!merged.length) return;
        setLines((prev) => [...prev, ...merged].slice(-500));
      } catch {
        setLines((prev) => [...prev, event.data].slice(-500));
      }
    };
    source.onerror = () => source.close();
    return () => source.close();
  }, [projectId]);

  const text = useMemo(() => lines.join("\n"), [lines]);

  return (
    <div className="h-full rounded-md border border-gray-200 dark:border-gray-700 bg-gray-950 overflow-auto">
      <pre className="p-3 text-xs text-gray-100 whitespace-pre-wrap">{text}</pre>
    </div>
  );
}

