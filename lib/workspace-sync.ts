import * as Y from "yjs";
import { fromBase64, toBase64 } from "@/lib/base64";
import { registerWorkspaceFlush, reportSync } from "@/lib/workspace-events";

// Durable, authenticated fallback transport. Local changes are immediate; a failed
// request keeps the CRDT update queued and retries on reconnect and every 2 seconds.
export class WorkspaceSync {
  private dirty = true;
  private version = 0;
  private stopped = false;
  private flight?: Promise<void>;
  private timer: ReturnType<typeof setInterval>;
  private debounce?: ReturnType<typeof setTimeout>;
  private unregister: () => void;
  constructor(private workspaceId: string, private surface: "doc" | "canvas", private generation: number, private doc: Y.Doc, private persist: (state: string) => void, private readonly readOnly = false) {
    this.dirty = !readOnly;
    this.doc.on("update", this.onUpdate);
    this.timer = setInterval(() => { void this.sync().catch(() => {}); }, 2000);
    window.addEventListener("online", this.online);
    window.addEventListener("offline", this.offline);
    window.addEventListener("pagehide", this.pageHide);
    this.unregister = registerWorkspaceFlush(workspaceId, () => this.flush());
    this.persist(toBase64(Y.encodeStateAsUpdate(doc)));
    queueMicrotask(() => { if (!this.stopped) void this.sync().catch(() => {}); });
  }
  private onUpdate = (_update: Uint8Array, origin: unknown) => {
    this.persist(toBase64(Y.encodeStateAsUpdate(this.doc)));
    if (origin === this || this.readOnly) return;
    this.dirty = true; this.version++;
    reportSync(this.workspaceId, this.surface, navigator.onLine ? "saving" : "offline");
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => { void this.sync().catch(() => {}); }, 400);
  };
  private online = () => { void this.sync().catch(() => {}); };
  private offline = () => reportSync(this.workspaceId, this.surface, "offline");
  private pageHide = () => {
    if (!this.dirty || this.stopped) return;
    const body = JSON.stringify({ surface: this.surface, generation: this.generation, state: toBase64(Y.encodeStateAsUpdate(this.doc)) });
    if (body.length < 60_000) void fetch(`/api/workspaces/${this.workspaceId}/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  };
  async flush() {
    await this.sync();
    if (this.dirty && !this.stopped) await this.sync();
  }
  private sync(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.flight) return this.flight;
    this.flight = this.exchange().finally(() => { this.flight = undefined; });
    return this.flight;
  }
  private async exchange() {
    const version = this.version;
    const writing = this.dirty;
    try {
      if (!navigator.onLine) throw new Error("Offline");
      const response = await fetch(`/api/workspaces/${this.workspaceId}/sync`, writing ? {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface: this.surface, generation: this.generation, state: toBase64(Y.encodeStateAsUpdate(this.doc)) }),
      } : { cache: "no-store" });
      if ([401,403,404,409].includes(response.status)) {
        this.stopped = true;
        window.location.reload();
        throw new Error("Workspace permissions or version changed");
      }
      if (!response.ok) throw new Error("Sync failed");
      const data = await response.json();
      if (this.stopped) return;
      if (!writing && data.generation !== this.generation) {
        this.stopped = true; window.location.reload(); return;
      }
      const state = writing ? data.state : data[this.surface];
      if (state) Y.applyUpdate(this.doc, fromBase64(state), this);
      if (writing && version === this.version) this.dirty = false;
      reportSync(this.workspaceId, this.surface, this.dirty ? "saving" : "saved");
    } catch (error) {
      reportSync(this.workspaceId, this.surface, navigator.onLine ? "error" : "offline");
      throw error;
    }
  }
  destroy() {
    this.pageHide(); this.stopped = true;
    clearInterval(this.timer); clearTimeout(this.debounce);
    this.doc.off("update", this.onUpdate);
    window.removeEventListener("online", this.online); window.removeEventListener("offline", this.offline); window.removeEventListener("pagehide", this.pageHide);
    this.unregister();
  }
}
