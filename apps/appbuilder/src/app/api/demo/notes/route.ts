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
import { ensureDataDocuments, listNotes, createNote } from "@/lib/data-api-client";

/**
 * GET /api/demo/notes
 * List all notes for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "data-api");
    if (auth instanceof NextResponse) return auth;

    const documentIds = await ensureDataDocuments(auth.apiToken);
    const { notes, total } = await listNotes(auth.apiToken, documentIds.notes);

    return NextResponse.json({
      notes,
      count: total,
    });
  } catch (error) {
    console.error("[DEMO] Failed to fetch notes:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch notes",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/demo/notes
 * Create a new note
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "data-api");
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { title, content } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Title is required and must be a string" },
        { status: 400 }
      );
    }

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required and must be a string" },
        { status: 400 }
      );
    }

    const documentIds = await ensureDataDocuments(auth.apiToken);
    const note = await createNote(auth.apiToken, documentIds.notes, {
      title: title.trim(),
      content: content.trim(),
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("[DEMO] Failed to create note:", error);
    return NextResponse.json(
      {
        error: "Failed to create note",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
