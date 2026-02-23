"use client";

interface PreviewPanelProps {
  projectId: string;
}

export function PreviewPanel({ projectId }: PreviewPanelProps) {
  return (
    <iframe
      title="Live Preview"
      src={`/preview/${projectId}/`}
      className="w-full h-full rounded-md border border-gray-200 dark:border-gray-700 bg-white"
    />
  );
}

