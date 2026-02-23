import {
  deleteRecords,
  ensureDocuments,
  generateId,
  getNow,
  insertRecords,
  queryRecords,
  updateRecords,
} from "@jazzmind/busibox-app";
import type { AppDataSchema } from "@jazzmind/busibox-app";
import type {
  BuilderProject,
  BuilderProjectStatus,
  CreateBuilderProjectInput,
  DemoNote,
  CreateNoteInput,
  UpdateNoteInput,
} from "./types";

export const DOCUMENTS = {
  PROJECTS: "busibox-appbuilder-projects",
  NOTES: "busibox-appbuilder-notes",
} as const;

const projectSchema: AppDataSchema = {
  fields: {
    id: { type: "string", required: true, hidden: true },
    name: { type: "string", required: true, label: "Name", order: 1 },
    slug: { type: "string", required: true, label: "Slug", order: 2 },
    description: {
      type: "string",
      required: false,
      label: "Description",
      multiline: true,
      order: 3,
    },
    status: {
      type: "enum",
      required: true,
      values: [
        "provisioning",
        "ready",
        "running",
        "failed",
        "deploying",
        "deployed",
        "stopped",
      ],
      label: "Status",
      order: 4,
    },
    routePath: { type: "string", required: true, label: "Route", order: 5 },
    devPort: { type: "integer", required: true, label: "Port", order: 6 },
    repoUrl: { type: "string", required: false, label: "Repo URL", order: 7 },
    lastError: { type: "string", required: false, label: "Last Error", order: 8 },
    agentMode: {
      type: "enum",
      required: true,
      values: ["auto", "builder", "builder-local"],
      label: "Agent Mode",
      order: 9,
    },
    templateVariant: {
      type: "enum",
      required: true,
      values: ["minimal", "standard", "chat-app", "api-only"],
      label: "Template Variant",
      order: 10,
    },
    createdBy: { type: "string", required: true, hidden: true },
    createdAt: { type: "string", required: true, hidden: true, readonly: true },
    updatedAt: { type: "string", required: true, hidden: true, readonly: true },
  },
  displayName: "App Builder Projects",
  itemLabel: "Builder Project",
  sourceApp: "busibox-appbuilder",
  visibility: "personal",
  allowSharing: false,
  graphNode: "",
  graphRelationships: [],
};

const noteSchema: AppDataSchema = {
  fields: {
    id: { type: "string", required: true, hidden: true },
    title: { type: "string", required: true, label: "Title", order: 1 },
    content: {
      type: "string",
      required: true,
      label: "Content",
      multiline: true,
      order: 2,
    },
    createdAt: {
      type: "string",
      label: "Created",
      readonly: true,
      hidden: true,
      order: 3,
    },
    updatedAt: {
      type: "string",
      label: "Updated",
      readonly: true,
      hidden: true,
      order: 4,
    },
  },
  displayName: "Notes",
  itemLabel: "Note",
  sourceApp: "busibox-appbuilder",
  visibility: "personal",
  allowSharing: false,
  graphNode: "",
  graphRelationships: [],
};

export async function ensureDataDocuments(
  token: string
): Promise<{ projects: string; notes: string }> {
  const ids = await ensureDocuments(
    token,
    {
      projects: {
        name: DOCUMENTS.PROJECTS,
        schema: projectSchema,
        visibility: "personal",
      },
      notes: {
        name: DOCUMENTS.NOTES,
        schema: noteSchema,
        visibility: "personal",
      },
    },
    "busibox-appbuilder"
  );

  return ids as { projects: string; notes: string };
}

export async function listProjects(
  token: string,
  documentId: string,
  createdBy: string
): Promise<BuilderProject[]> {
  const result = await queryRecords<BuilderProject>(token, documentId, {
    where: {
      and: [{ field: "createdBy", op: "eq", value: createdBy }],
    },
    orderBy: [{ field: "updatedAt", direction: "desc" }],
  });
  return result.records;
}

export async function getProject(
  token: string,
  documentId: string,
  projectId: string
): Promise<BuilderProject | null> {
  const result = await queryRecords<BuilderProject>(token, documentId, {
    where: { field: "id", op: "eq", value: projectId },
    limit: 1,
  });
  return result.records[0] || null;
}

export function createProjectRecord(
  input: CreateBuilderProjectInput,
  createdBy: string,
  devPort: number
): BuilderProject {
  const now = getNow();
  const slug = slugify(input.name);
  return {
    id: generateId(),
    name: input.name,
    slug,
    description: input.description || "",
    status: "provisioning",
    routePath: input.routePath || `/builder/${slug}`,
    devPort,
    repoUrl: null,
    lastError: null,
    agentMode: input.agentMode || "auto",
    templateVariant: input.templateVariant || "standard",
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
}

export async function insertProject(
  token: string,
  documentId: string,
  project: BuilderProject
): Promise<void> {
  await insertRecords(token, documentId, [project]);
}

export async function updateProjectStatus(
  token: string,
  documentId: string,
  projectId: string,
  status: BuilderProjectStatus,
  lastError?: string | null
): Promise<void> {
  await updateRecords(
    token,
    documentId,
    {
      status,
      lastError: lastError || null,
      updatedAt: getNow(),
    },
    { field: "id", op: "eq", value: projectId }
  );
}

export async function deleteProject(
  token: string,
  documentId: string,
  projectId: string
): Promise<void> {
  await deleteRecords(token, documentId, { field: "id", op: "eq", value: projectId });
}

// ==========================================================================
// Demo Note Operations (delete when building real app)
// ==========================================================================

export async function listNotes(
  token: string,
  documentId: string,
  options?: { limit?: number; offset?: number }
): Promise<{ notes: DemoNote[]; total: number }> {
  const result = await queryRecords<DemoNote>(token, documentId, {
    orderBy: [{ field: "createdAt", direction: "desc" }],
    limit: options?.limit,
    offset: options?.offset,
  });
  return { notes: result.records, total: result.total };
}

export async function getNote(
  token: string,
  documentId: string,
  noteId: string
): Promise<DemoNote | null> {
  const result = await queryRecords<DemoNote>(token, documentId, {
    where: { field: "id", op: "eq", value: noteId },
    limit: 1,
  });
  return result.records[0] || null;
}

export async function createNote(
  token: string,
  documentId: string,
  input: CreateNoteInput
): Promise<DemoNote> {
  const now = getNow();
  const note: DemoNote = {
    id: generateId(),
    title: input.title,
    content: input.content,
    createdAt: now,
    updatedAt: now,
  };
  await insertRecords(token, documentId, [note]);
  return note;
}

export async function updateNote(
  token: string,
  documentId: string,
  noteId: string,
  input: UpdateNoteInput
): Promise<DemoNote | null> {
  const existing = await getNote(token, documentId, noteId);
  if (!existing) return null;

  const updates = {
    ...input,
    updatedAt: getNow(),
  };

  await updateRecords(
    token,
    documentId,
    updates,
    { field: "id", op: "eq", value: noteId }
  );

  return { ...existing, ...updates };
}

export async function deleteNote(
  token: string,
  documentId: string,
  noteId: string
): Promise<boolean> {
  const result = await deleteRecords(token, documentId, {
    field: "id",
    op: "eq",
    value: noteId,
  });
  return result.count > 0;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
