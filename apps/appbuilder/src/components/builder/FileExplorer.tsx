"use client";

import { useEffect, useState } from "react";

interface FileExplorerProps {
  projectId: string;
}

export function FileExplorer({ projectId }: FileExplorerProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function loadFiles() {
      try {
        setError("");
        const res = await fetch(`/api/builder/projects/${projectId}/files`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to list files");
        if (!cancelled) {
          setFiles(data.files || []);
          if (!selected && data.files?.length) setSelected(data.files[0]);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to load files");
      }
    }
    loadFiles();
    return () => {
      cancelled = true;
    };
  }, [projectId, selected]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    async function loadContent() {
      try {
        const encoded = selected.split("/").map(encodeURIComponent).join("/");
        const res = await fetch(`/api/builder/projects/${projectId}/files/${encoded}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to read file");
        if (!cancelled) setContent(data.contents || "");
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to load file");
      }
    }
    loadContent();
    return () => {
      cancelled = true;
    };
  }, [projectId, selected]);

  return (
    <div className="h-full grid grid-cols-12 gap-3">
      <div className="col-span-4 border border-gray-200 dark:border-gray-700 rounded-md overflow-auto">
        {files.map((file) => (
          <button
            key={file}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${
              selected === file ? "bg-gray-100 dark:bg-gray-800 font-medium" : ""
            }`}
            onClick={() => setSelected(file)}
          >
            {file}
          </button>
        ))}
      </div>
      <div className="col-span-8 border border-gray-200 dark:border-gray-700 rounded-md overflow-auto bg-gray-950">
        {error ? (
          <div className="p-3 text-sm text-red-300">{error}</div>
        ) : (
          <pre className="p-3 text-xs text-gray-100 whitespace-pre-wrap">{content}</pre>
        )}
      </div>
    </div>
  );
}

