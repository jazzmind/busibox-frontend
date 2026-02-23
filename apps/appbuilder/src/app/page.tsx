"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

import type { BuilderProject } from "@/lib/types";

export default function HomePage() {
  const [projects, setProjects] = useState<BuilderProject[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateVariant, setTemplateVariant] = useState<"minimal" | "standard" | "chat-app" | "api-only">("standard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refreshProjects() {
    const response = await fetch("/api/builder/projects");
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Failed to load projects");
      return;
    }
    setProjects(data.projects || []);
  }

  useEffect(() => {
    refreshProjects();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/builder/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, templateVariant }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create project");
      setName("");
      setDescription("");
      setTemplateVariant("standard");
      await refreshProjects();
    } catch (err: any) {
      setError(err.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Busibox App Builder</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Build and iterate apps with conversational AI, live preview, and one-click deployment.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3"
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create project</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description"
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm h-24"
        />
        <select
          value={templateVariant}
          onChange={(e) => setTemplateVariant(e.target.value as any)}
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
        >
          <option value="standard">standard</option>
          <option value="minimal">minimal</option>
          <option value="chat-app">chat-app</option>
          <option value="api-only">api-only</option>
        </select>
        <div className="flex items-center justify-between">
          <span className="text-sm text-red-500">{error}</span>
          <button
            disabled={loading}
            className="px-4 py-2 rounded-md bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-sm font-medium disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((project) => (
          <div
            key={project.id}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">{project.name}</h3>
              <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">
                {project.status}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 min-h-10">
              {project.description || "No description"}
            </p>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>{project.routePath}</span>
              <span>:{project.devPort}</span>
            </div>
            <div className="mt-1 text-xs text-gray-500">template: {project.templateVariant}</div>
            <div className="mt-4 flex gap-2">
              <Link
                href={`/build/${project.id}`}
                className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 text-sm"
              >
                Open Builder
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div>
        <Link href="/library" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          Browse App Library
        </Link>
      </div>
    </div>
  );
}
