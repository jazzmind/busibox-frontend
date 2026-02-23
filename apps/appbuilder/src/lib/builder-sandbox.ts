import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CONTAINER_PREFIX = process.env.CONTAINER_PREFIX || "dev";
const BUILDER_CONTAINER = `${CONTAINER_PREFIX}-builder-sandbox`;
const TEMPLATE_SOURCE =
  process.env.BUILDER_TEMPLATE_SOURCE || "/Users/wsonnenreich/Code/busibox-template";
const PROJECT_ROOT = process.env.BUILDER_PROJECT_ROOT || "/srv/projects";

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runInBuilderSandbox(
  command: string,
  timeoutMs = 300_000
): Promise<CommandResult> {
  try {
    const { stdout, stderr } = await execFileAsync(
      "docker",
      ["exec", BUILDER_CONTAINER, "/bin/bash", "-lc", command],
      { timeout: timeoutMs, maxBuffer: 1024 * 1024 * 10 }
    );
    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error?.stdout || "",
      stderr: error?.stderr || error?.message || "Unknown error",
      exitCode: error?.code ?? 1,
    };
  }
}

export async function provisionProjectWorkspace(options: {
  projectId: string;
  appName: string;
  routePath: string;
  devPort: number;
  templateVariant?: "minimal" | "standard" | "chat-app" | "api-only";
}): Promise<void> {
  const projectDir = `${PROJECT_ROOT}/${options.projectId}`;
  const safeName = options.appName.replace(/"/g, '\\"');
  const safeRoute = options.routePath.replace(/"/g, '\\"');

  const setup = [
    `set -euo pipefail`,
    `mkdir -p "${PROJECT_ROOT}"`,
    `rm -rf "${projectDir}"`,
    `mkdir -p "${projectDir}"`,
    `cp -R "${TEMPLATE_SOURCE}/." "${projectDir}/"`,
    `rm -rf "${projectDir}/node_modules"`,
    `python3 - <<'PY'`,
    `import json, pathlib`,
    `project = pathlib.Path("${projectDir}")`,
    `pkg_path = project / "package.json"`,
    `manifest_path = project / "busibox.json"`,
    `env_path = project / "env.example"`,
    `pkg = json.loads(pkg_path.read_text())`,
    `pkg["name"] = "busibox-builder-app-${options.projectId}"`,
    `scripts = pkg.get("scripts", {})`,
    `scripts["dev"] = "next dev -p ${options.devPort}"`,
    `scripts["start"] = "next start -p ${options.devPort}"`,
    `pkg["scripts"] = scripts`,
    `pkg_path.write_text(json.dumps(pkg, indent=2) + "\\n")`,
    `manifest = json.loads(manifest_path.read_text())`,
    `manifest["name"] = "${safeName}"`,
    `manifest["id"] = "${options.projectId}"`,
    `manifest["defaultPath"] = "${safeRoute}"`,
    `manifest["defaultPort"] = ${options.devPort}`,
    `manifest_path.write_text(json.dumps(manifest, indent=2) + "\\n")`,
    `env = env_path.read_text()`,
    `env = env.replace("APP_NAME=busibox-appbuilder", "APP_NAME=${options.projectId}")`,
    `env = env.replace("PORT=3004", "PORT=${options.devPort}")`,
    `env = env.replace("NEXT_PUBLIC_BASE_PATH=", "NEXT_PUBLIC_BASE_PATH=${safeRoute}")`,
    `env_path.write_text(env)`,
    `variant = "${options.templateVariant ?? "standard"}"`,
    `if variant == "minimal":`,
    `    (project / "app" / "page.tsx").write_text("export default function Page(){return <main className='p-8'><h1>${safeName}</h1></main>}\\n")`,
    `elif variant == "api-only":`,
    `    (project / "app" / "page.tsx").write_text("export default function Page(){return <main className='p-8'><h1>${safeName} API</h1><p>No UI scaffold.</p></main>}\\n")`,
    `elif variant == "chat-app":`,
    `    (project / "app" / "page.tsx").write_text("'use client';\\nimport { SimpleChatInterface } from '@jazzmind/busibox-app';\\nexport default function Page(){return <div className='p-4 h-screen'><SimpleChatInterface token='' agentUrl='/api/agent' agentId='chat-agent' /></div>}\\n")`,
    `PY`,
    `cd "${projectDir}"`,
    `npm install`,
  ].join("\n");

  const result = await runInBuilderSandbox(setup, 900_000);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "Failed to provision project workspace");
  }
}

export async function listProjectFiles(projectId: string): Promise<string[]> {
  const projectDir = `${PROJECT_ROOT}/${projectId}`;
  const result = await runInBuilderSandbox(
    `set -euo pipefail && cd "${projectDir}" && find . -type f -not -path "*/node_modules/*" -not -path "*/.next/*" | sort`,
    60_000
  );
  if (result.exitCode !== 0) return [];
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function readProjectFile(projectId: string, filePath: string): Promise<string> {
  const safePath = filePath.replace(/"/g, "");
  const projectDir = `${PROJECT_ROOT}/${projectId}`;
  const result = await runInBuilderSandbox(
    `set -euo pipefail && cd "${projectDir}" && cat "${safePath}"`,
    60_000
  );
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "Unable to read file");
  }
  return result.stdout;
}
