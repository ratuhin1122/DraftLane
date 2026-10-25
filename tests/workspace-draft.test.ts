import assert from "node:assert/strict";
import { test } from "node:test";
import * as Y from "yjs";
import type { TLEditorSnapshot } from "tldraw";
import { readCanvasDraft, writeCanvasDraft, readDocDraft, writeDocDraft } from "../lib/workspace-draft";

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
} });

test("recover unsaved canvas shapes after leaving; newer server state wins", () => {
  const snapshot = { document: { store: { arrow: { type: "arrow" }, label: { type: "text", text: "Keep this" } } } } as unknown as TLEditorSnapshot;
  writeCanvasDraft("first", snapshot);
  assert.deepEqual(readCanvasDraft("first", 0), snapshot);
  assert.equal(readCanvasDraft("first", Date.now() + 1000), null);
  assert.equal(readCanvasDraft("another-workspace", 0), null);
});

test("invalid local canvas cache does not prevent loading saved data", () => {
  storage.set("draftlane:canvas:broken", "invalid json");
  assert.equal(readCanvasDraft("broken", 0), null);
});

test("document recovery merges with saved state and preserves text edits and deletions", () => {
  const original = new Y.Doc();
  original.getText("document").insert(0, "Draft");
  const saved = Y.encodeStateAsUpdate(original);
  original.getText("document").delete(0, 5);
  original.getText("document").insert(0, "Revised plan");
  writeDocDraft("first", Buffer.from(Y.encodeStateAsUpdate(original)).toString("base64"));
  const reopened = new Y.Doc();
  Y.applyUpdate(reopened, saved);
  Y.applyUpdate(reopened, Buffer.from(readDocDraft("first")!, "base64"));
  assert.equal(reopened.getText("document").toString(), "Revised plan");
  assert.equal(readDocDraft("another-workspace"), null);
  original.destroy(); reopened.destroy();
});
