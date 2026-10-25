export type WorkspaceRole = "VIEWER" | "COMMENTER" | "EDITOR" | "MANAGER";
export type WorkspaceCapability = "view" | "comment" | "edit" | "manage";
const levels: Record<WorkspaceRole, number> = { VIEWER: 0, COMMENTER: 1, EDITOR: 2, MANAGER: 3 };
export function permits(role: WorkspaceRole | null, capability: WorkspaceCapability) {
  return role !== null && levels[role] >= { view: 0, comment: 1, edit: 2, manage: 3 }[capability];
}
