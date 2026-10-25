"use server";
import { canAccessWorkspace } from "@/lib/workspace-access";
import { persistCanvas } from "@/lib/workspace-persistence";
import type { Prisma } from "@/lib/generated/prisma/client";
import * as Y from "yjs";
import { updateCanvasCrdt, type CanvasSnapshot } from "@/lib/canvas-crdt";
// Legacy callers still save through the same generation-checked CRDT path.
export async function saveCanvasContent(workspaceId: string, content: Prisma.InputJsonValue, generation = 0) {
  if (!(await canAccessWorkspace(workspaceId, "edit"))) throw new Error("Editing permission required");
  const doc = new Y.Doc();
  try { updateCanvasCrdt(doc, content as unknown as CanvasSnapshot); return await persistCanvas(workspaceId, Y.encodeStateAsUpdate(doc), generation); }
  finally { doc.destroy(); }
}
