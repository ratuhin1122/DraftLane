import type { TLEditorSnapshot } from "tldraw";

type CanvasDraft = { updatedAt: number; snapshot: TLEditorSnapshot };
export function readCanvasDraft(workspaceId: string, savedAt: number, generation = 0): TLEditorSnapshot | null {
  try {
    const raw = localStorage.getItem(`draftlane:canvas:${workspaceId}${generation ? `:${generation}` : ""}`);
    if (!raw) return null;
    const draft = JSON.parse(raw) as CanvasDraft;
    return draft.updatedAt > savedAt ? draft.snapshot : null;
  } catch { return null; }
}
export function writeCanvasDraft(workspaceId: string, snapshot: TLEditorSnapshot, generation = 0) {
  try { localStorage.setItem(`draftlane:canvas:${workspaceId}${generation ? `:${generation}` : ""}`, JSON.stringify({ updatedAt: Date.now(), snapshot })); } catch { /* Database saving still works when storage is full or unavailable. */ }
}
export function readDocDraft(workspaceId: string, generation = 0): string | null {
  try { return localStorage.getItem(`draftlane:doc:${workspaceId}${generation ? `:${generation}` : ""}`); } catch { return null; }
}
export function writeDocDraft(workspaceId: string, state: string, generation = 0) {
  try { localStorage.setItem(`draftlane:doc:${workspaceId}${generation ? `:${generation}` : ""}`, state); } catch { /* Database saving remains available. */ }
}

export function readCanvasCrdtDraft(workspaceId: string, generation: number): string | null {
  try { return localStorage.getItem(`draftlane:canvas-crdt:${workspaceId}:${generation}`); } catch { return null; }
}
export function writeCanvasCrdtDraft(workspaceId: string, generation: number, state: string) {
  try { localStorage.setItem(`draftlane:canvas-crdt:${workspaceId}:${generation}`, state); } catch { /* Server sync remains available. */ }
}
