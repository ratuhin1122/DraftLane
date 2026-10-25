export const FLUSH_EVENT = "draftlane:flush";
export type FlushDetail = { workspaceId: string; waitUntil: (promise: Promise<unknown>) => void };
export async function flushWorkspace(workspaceId: string) {
  const promises: Promise<unknown>[] = [];
  window.dispatchEvent(new CustomEvent<FlushDetail>(FLUSH_EVENT, { detail: { workspaceId, waitUntil: p => promises.push(p) } }));
  await Promise.all(promises);
}
export function registerWorkspaceFlush(workspaceId: string, flush: () => Promise<unknown>) {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<FlushDetail>).detail;
    if (detail.workspaceId === workspaceId) detail.waitUntil(flush());
  };
  window.addEventListener(FLUSH_EVENT, handler);
  return () => window.removeEventListener(FLUSH_EVENT, handler);
}
export type SyncStatus = "saving" | "saved" | "offline" | "error";
export function reportSync(workspaceId: string, surface: string, status: SyncStatus) {
  window.dispatchEvent(new CustomEvent("draftlane:sync-status", { detail: { workspaceId, surface, status } }));
}
