import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";

// BlockNote's cursor/selection adapter. Cross-client data uses the authenticated
// workspace sync endpoint, rather than publicly writable Supabase broadcasts.
export class SupabaseYjsProvider {
  readonly awareness: Awareness;
  private destroyed = false;
  constructor(doc: Y.Doc, _roomId: string, onReady: () => void) {
    this.awareness = new Awareness(doc);
    queueMicrotask(() => { if (!this.destroyed) onReady(); });
  }
  destroy() { this.destroyed = true; this.awareness.destroy(); }
}
