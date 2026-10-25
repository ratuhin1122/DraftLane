import * as Y from "yjs";

type DocumentSnapshot = { store: Record<string, unknown>; schema: unknown };
export type CanvasSnapshot = { document: DocumentSnapshot; session?: unknown };

// Each canvas record is a separate CRDT register. Concurrent edits to different objects
// survive; concurrent writes/deletions to one record converge using Yjs's ordering.
export function updateCanvasCrdt(doc: Y.Doc, snapshot: CanvasSnapshot) {
  const records = doc.getMap<string>("records");
  doc.transact(() => {
    for (const key of records.keys()) if (!(key in snapshot.document.store)) records.delete(key);
    for (const [key, value] of Object.entries(snapshot.document.store)) {
      const encoded = JSON.stringify(value);
      if (records.get(key) !== encoded) records.set(key, encoded);
    }
    const schema = JSON.stringify(snapshot.document.schema);
    if (doc.getMap<string>("metadata").get("schema") !== schema) doc.getMap<string>("metadata").set("schema", schema);
  });
}
export function canvasFromCrdt(doc: Y.Doc): CanvasSnapshot | null {
  const schema = doc.getMap<string>("metadata").get("schema");
  if (!schema) return null;
  return { document: { store: Object.fromEntries([...doc.getMap<string>("records")].map(([key, value]) => [key, JSON.parse(value)])), schema: JSON.parse(schema) } };
}
export function mergeCanvasStates(current: Uint8Array | null, incoming: Uint8Array) {
  const doc = new Y.Doc();
  try {
    if (current) Y.applyUpdate(doc, current);
    Y.applyUpdate(doc, incoming);
    return { state: Y.encodeStateAsUpdate(doc), snapshot: canvasFromCrdt(doc) };
  } finally { doc.destroy(); }
}
