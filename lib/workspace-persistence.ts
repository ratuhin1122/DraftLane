import { maybeCheckpoint } from "@/lib/workspace-history";
import * as Y from "yjs";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { updateCanvasCrdt, mergeCanvasStates, type CanvasSnapshot } from "@/lib/canvas-crdt";

let headlessEditor: import("@blocknote/core").BlockNoteEditor | undefined;

export const STALE_WORKSPACE = "This workspace was restored. Reload to continue editing.";
export async function lockGeneration(tx: Prisma.TransactionClient, workspaceId: string, generation: number) {
  const [row] = await tx.$queryRaw<{ generation: number }[]>`SELECT "generation" FROM "Workspace" WHERE "id" = ${workspaceId} FOR UPDATE`;
  if (!row || row.generation !== generation) throw new Error(STALE_WORKSPACE);
}
export async function ensureCanvasState(workspaceId: string) {
  return prisma.$transaction(async tx => {
    const [row] = await tx.$queryRaw<{ yjsState: Uint8Array | null; content: unknown }[]>`SELECT "yjsState", "content" FROM "Canvas" WHERE "workspaceId" = ${workspaceId} FOR UPDATE`;
    if (!row || row.yjsState) return row?.yjsState ?? null;
    const doc = new Y.Doc();
    try {
      if (row.content && typeof row.content === "object" && "document" in row.content) updateCanvasCrdt(doc, row.content as CanvasSnapshot);
      const state = Y.encodeStateAsUpdate(doc);
      await tx.canvas.update({ where: { workspaceId }, data: { yjsState: Uint8Array.from(state) } });
      return state;
    } finally { doc.destroy(); }
  });
}
export async function ensureDocState(workspaceId: string) {
  return prisma.$transaction(async tx => {
    const [row] = await tx.$queryRaw<{ yjsState: Uint8Array | null; content: unknown }[]>`SELECT "yjsState", "content" FROM "Doc" WHERE "workspaceId" = ${workspaceId} FOR UPDATE`;
    if (!row || row.yjsState) return;
    const [{ BlockNoteEditor }, { blocksToYDoc }, runtimeY] = await Promise.all([import("@blocknote/core"), import("@blocknote/core/yjs"), import("yjs")]);
    const editor = headlessEditor ??= BlockNoteEditor.create();
    const content = Array.isArray(row.content) && row.content.length ? row.content : [{ type: "paragraph", content: [] }];
    const doc = blocksToYDoc(editor, content as import("@blocknote/core").PartialBlock[], "document-store");
    try { await tx.doc.update({ where: { workspaceId }, data: { yjsState: Uint8Array.from(runtimeY.encodeStateAsUpdate(doc)) } }); }
    finally { doc.destroy(); }
  }, { timeout: 20000 });
}
export async function persistCanvas(workspaceId: string, state: Uint8Array, generation: number) {
  return prisma.$transaction(async tx => {
    await lockGeneration(tx, workspaceId, generation);
    await maybeCheckpoint(tx, workspaceId);
    const row = await tx.canvas.findUniqueOrThrow({ where: { workspaceId } });
    const merged = mergeCanvasStates(row.yjsState, state);
    if (!merged.snapshot) throw new Error("Invalid canvas state");
    const saved = await tx.canvas.update({ where: { workspaceId }, data: { yjsState: Uint8Array.from(merged.state), content: merged.snapshot as unknown as Prisma.InputJsonValue } });
    return { state: Buffer.from(merged.state).toString("base64"), updatedAt: saved.updatedAt.toISOString() };
  });
}
export async function persistDoc(workspaceId: string, state: Uint8Array, generation: number) {
  return prisma.$transaction(async tx => {
    await lockGeneration(tx, workspaceId, generation);
    await maybeCheckpoint(tx, workspaceId);
    const row = await tx.doc.findUniqueOrThrow({ where: { workspaceId } });
    const runtimeY = await import("yjs");
    const doc = new runtimeY.Doc();
    try {
      if (row.yjsState) runtimeY.applyUpdate(doc, row.yjsState);
      runtimeY.applyUpdate(doc, state);
      const [{ BlockNoteEditor }, { yDocToBlocks }] = await Promise.all([import("@blocknote/core"), import("@blocknote/core/yjs")]);
      const editor = headlessEditor ??= BlockNoteEditor.create();
      const content = yDocToBlocks(editor, doc, "document-store");
      const merged = runtimeY.encodeStateAsUpdate(doc);
      const saved = await tx.doc.update({ where: { workspaceId }, data: { yjsState: Uint8Array.from(merged), content: JSON.parse(JSON.stringify(content)) } });
      return { state: Buffer.from(merged).toString("base64"), updatedAt: saved.updatedAt.toISOString() };
    } finally { doc.destroy(); }
  }, { timeout: 20000 });
}
