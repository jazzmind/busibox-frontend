/**
 * ============================================
 * DEMO FILE - DELETE WHEN BUILDING REAL APP
 * ============================================
 * 
 * This file is part of the busibox-template demo.
 * Delete this entire file when starting your real app.
 * 
 * See DEMO.md for complete deletion checklist.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@jazzmind/busibox-app/lib/next/middleware";
import { ensureDataDocuments, getNote, updateNote, deleteNote } from "@/lib/data-api-client";

/**
 * GET /api/demo/notes/[id]
 * Get a single note by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "data-api");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const documentIds = await ensureDataDocuments(auth.apiToken);
    const note = await getNote(auth.apiToken, documentIds.notes, id);

    if (!note) {
      return NextResponse.json(
        { error: "Note not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(note);
  } catch (error) {
    console.error("[DEMO] Failed to fetch note:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch note",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/demo/notes/[id]
 * Update a note
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "data-api");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();
    const { title, content } = body;

    const updateData: { title?: string; content?: string } = {};
    
    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return NextResponse.json(
          { error: "Title must be a non-empty string" },
          { status: 400 }
        );
      }
      updateData.title = title.trim();
    }

    if (content !== undefined) {
      if (typeof content !== "string" || !content.trim()) {
        return NextResponse.json(
          { error: "Content must be a non-empty string" },
          { status: 400 }
        );
      }
      updateData.content = content.trim();
    }

    const documentIds = await ensureDataDocuments(auth.apiToken);
    const note = await updateNote(auth.apiToken, documentIds.notes, id, updateData);

    if (!note) {
      return NextResponse.json(
        { error: "Note not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(note);
  } catch (error) {
    console.error("[DEMO] Failed to update note:", error);
    return NextResponse.json(
      {
        error: "Failed to update note",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/demo/notes/[id]
 * Delete a note
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "data-api");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const documentIds = await ensureDataDocuments(auth.apiToken);
    const deleted = await deleteNote(auth.apiToken, documentIds.notes, id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Note not found" },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[DEMO] Failed to delete note:", error);
    return NextResponse.json(
      {
        error: "Failed to delete note",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
