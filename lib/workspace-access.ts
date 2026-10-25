import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { permits, type WorkspaceRole, type WorkspaceCapability } from "@/lib/workspace-permissions";

export async function getWorkspaceRole(workspaceId: string): Promise<WorkspaceRole | null> {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) return null;
  if (!(await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true } }))) return null;
  if (await prisma.accountDeletion.findUnique({ where: { clerkId: userId } })) return null;
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: {
    creator: { select: { clerkId: true } }, clerkOrgId: true,
    members: { where: { user: { clerkId: userId } }, select: { role: true } },
  } });
  if (!workspace) return null;
  if (workspace.creator.clerkId === userId) return "MANAGER";
  if (workspace.clerkOrgId === orgId && orgRole === "org:admin") return "MANAGER";
  const explicit = workspace.members[0]?.role;
  if (explicit && ["VIEWER", "COMMENTER", "EDITOR"].includes(explicit)) return explicit as WorkspaceRole;
  if (!workspace.clerkOrgId) return null;
  if (workspace.clerkOrgId === orgId) return orgRole === "org:viewer" ? "VIEWER" : "EDITOR";
  const clerk = await clerkClient();
  for (let offset = 0; ; offset += 100) {
    const { data, totalCount } = await clerk.users.getOrganizationMembershipList({ userId, limit: 100, offset });
    const membership = data.find((m) => m.organization.id === workspace.clerkOrgId);
    if (membership) return membership.role === "org:admin" ? "MANAGER" : membership.role === "org:viewer" ? "VIEWER" : "EDITOR";
    if (offset + data.length >= totalCount || !data.length) break;
  }
  return null;
}
export async function canAccessWorkspace(workspaceId: string, capability: WorkspaceCapability = "view") {
  return permits(await getWorkspaceRole(workspaceId), capability);
}
