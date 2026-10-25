import type { TLEditorSnapshot } from "tldraw";

type CanvasDraft = { updatedAt: number; snapshot: TLEditorSnapshot };
export function readCanvasDraft(workspaceId: string, savedAt: number): TLEditorSnapshot | null {
  try {
    const raw = localStorage.getItem(`draftlane:canvas:${workspaceId}`);
    if (!raw) return null;
    const draft = JSON.parse(raw) as CanvasDraft;
    return draft.updatedAt > savedAt ? draft.snapshot : null;
  } catch { return null; }
}
export function writeCanvasDraft(workspaceId: string, snapshot: TLEditorSnapshot) {
  try { localStorage.setItem(`draftlane:canvas:${workspaceId}`, JSON.stringify({ updatedAt: Date.now(), snapshot })); } catch { /* Database saving still works when storage is full or unavailable. */ }
}
export function readDocDraft(workspaceId: string): string | null {
  try { return localStorage.getItem(`draftlane:doc:${workspaceId}`); } catch { return null; }
}
export function writeDocDraft(workspaceId: string, state: string) {
  try { localStorage.setItem(`draftlane:doc:${workspaceId}`, state); } catch { /* Database saving remains available. */ }
}
