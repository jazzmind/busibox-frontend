"use client";

import { useEffect, useMemo, useState } from "react";
import { SimpleChatInterface } from "@jazzmind/busibox-app";
import { useCrossAppBasePath } from "@jazzmind/busibox-app/contexts/ApiContext";

import { FileExplorer } from "./FileExplorer";
import { LogPanel } from "./LogPanel";
import { PreviewPanel } from "./PreviewPanel";

type Tab = "preview" | "files" | "logs";

interface WorkspaceLayoutProps {
  projectId: string;
  projectName: string;
}

export function WorkspaceLayout({ projectId, projectName }: WorkspaceLayoutProps) {
  const agentsBase = useCrossAppBasePath("agents");
  const [tab, setTab] = useState<Tab>("preview");
  const [token, setToken] = useState<string>("");
  const [agentId, setAgentId] = useState<"builder" | "builder-local">("builder");
  const [conversationId, setConversationId] = useState<string>(`builder-${projectId}`);

  useEffect(() => {
    const key = `busibox-appbuilder:conversation:${projectId}`;
    const existing = window.localStorage.getItem(key);
    if (existing) {
      setConversationId(existing);
      return;
    }
    const generated = `builder-${projectId}-${Date.now()}`;
    window.localStorage.setItem(key, generated);
    setConversationId(generated);
  }, [projectId]);

  useEffect(() => {
    async function loadToken() {
      const response = await fetch("/api/auth/session", { method: "POST" });
      if (!response.ok) return;
      const data = await response.json();
      setToken(data.token || "");
    }
    loadToken();
  }, []);

  const metadata = useMemo(
    () => ({ projectId, projectName, appName: "busibox-appbuilder", conversationId }),
    [projectId, projectName, conversationId]
  );

  return (
    <div className="h-[calc(100vh-180px)] grid grid-cols-12 gap-4">
      <div className="col-span-5 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
        {token ? (
          <SimpleChatInterface
            token={token}
            agentUrl={`${agentsBase}/api/agent`}
            agentId={agentId}
            placeholder="Describe what you want to build..."
            welcomeMessage={`Let's build **${projectName}**. Tell me what to create first.`}
            useStreaming={true}
            useAgenticStreaming={true}
            model="agent"
            enableWebSearch={false}
            enableDocSearch={false}
            allowAttachments={false}
            {...({ conversationId } as any)}
            {...({ metadata } as any)}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-gray-500">
            Connecting to builder agent...
          </div>
        )}
      </div>

      <div className="col-span-7 border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-white dark:bg-gray-900">
        <div className="flex gap-2 mb-3 items-center">
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value as "builder" | "builder-local")}
            className="px-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-transparent"
          >
            <option value="builder">builder</option>
            <option value="builder-local">builder-local</option>
          </select>
          {(["preview", "files", "logs"] as Tab[]).map((nextTab) => (
            <button
              key={nextTab}
              className={`px-3 py-1.5 text-sm rounded-md border ${
                tab === nextTab
                  ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white"
                  : "border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
              }`}
              onClick={() => setTab(nextTab)}
            >
              {nextTab}
            </button>
          ))}
        </div>
        <div className="h-[calc(100%-42px)]">
          {tab === "preview" && <PreviewPanel projectId={projectId} />}
          {tab === "files" && <FileExplorer projectId={projectId} />}
          {tab === "logs" && <LogPanel projectId={projectId} />}
        </div>
      </div>
    </div>
  );
}

