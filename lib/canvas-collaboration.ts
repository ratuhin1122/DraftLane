import * as Y from "yjs";
import type { Editor, TLRecord, TLPageId } from "tldraw";
import { WorkspaceSync } from "@/lib/workspace-sync";
import { updateCanvasCrdt, canvasFromCrdt, type CanvasSnapshot } from "@/lib/canvas-crdt";
import { readCanvasCrdtDraft, writeCanvasCrdtDraft, readCanvasDraft } from "@/lib/workspace-draft";
import { fromBase64 } from "@/lib/base64";

export function attachCanvasSync(editor: Editor, workspaceId: string, generation: number, initialState: string | null, savedAt: number, readOnly = false) {
  const doc = new Y.Doc();
  if (initialState) Y.applyUpdate(doc, fromBase64(initialState));
  const cached = readOnly ? null : readCanvasCrdtDraft(workspaceId, generation);
  if (cached) Y.applyUpdate(doc, fromBase64(cached));
  let initial = canvasFromCrdt(doc);
  if (!initial) {
    const recovered = readOnly ? null : readCanvasDraft(workspaceId, savedAt, generation);
    if (recovered) editor.loadSnapshot(recovered);
    if (!recovered && !editor.getCurrentPageShapeIds().size) {
      const page = "page:draftlane" as TLPageId;
      if (!editor.getPage(page)) editor.createPage({ id: page, name: "Page 1" });
      editor.setCurrentPage(page);
      for (const other of editor.getPages()) if (other.id !== page) editor.deletePage(other.id);
    }
    updateCanvasCrdt(doc, editor.getSnapshot() as unknown as CanvasSnapshot);
    initial = canvasFromCrdt(doc);
  }
  if (initial) editor.loadSnapshot(initial as Parameters<Editor["loadSnapshot"]>[0]);
  const apply = () => {
    const remote = canvasFromCrdt(doc);
    if (!remote) return;
    const current = editor.getSnapshot().document.store;
    editor.store.mergeRemoteChanges(() => {
      const changed = Object.entries(remote.document.store).filter(([id, value]) => JSON.stringify(current[id as keyof typeof current]) !== JSON.stringify(value)).map(([, value]) => value);
      const removed = Object.keys(current).filter(id => !(id in remote.document.store));
      if (changed.length) editor.store.put(changed as TLRecord[]);
      if (removed.length) editor.store.remove(removed as TLRecord["id"][]);
    });
  };
  doc.on("update", apply);
  const stop = editor.store.listen(() => updateCanvasCrdt(doc, editor.getSnapshot() as unknown as CanvasSnapshot), { source: "user", scope: "document" });
  const sync = new WorkspaceSync(workspaceId, "canvas", generation, doc, state => writeCanvasCrdtDraft(workspaceId, generation, state), readOnly);
  return () => { stop(); sync.destroy(); doc.off("update", apply); doc.destroy(); };
}
