"use server";

import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { requireActiveAccount } from "@/lib/account-deletion";
import { lockGeneration } from "@/lib/workspace-persistence";
import { prisma } from "@/lib/prisma";
import { canAccessWorkspace, getWorkspaceRole } from "@/lib/workspace-access";
import { checkUser } from "@/actions/check-user";
import { writeSnapshot, restoreSnapshot } from "@/lib/workspace-history";

async function requireAccess(id: string, capability: "view" | "comment" | "edit" | "manage") {
  if (!(await canAccessWorkspace(id, capability))) throw new Error("You do not have permission for this action.");
}
export async function getWorkspaceActivity(workspaceId: string) {
  const role = await getWorkspaceRole(workspaceId);
  if (!role) throw new Error("Workspace not found");
  const [comments, snapshots, tasks, members] = await Promise.all([
    prisma.workspaceComment.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.workspaceSnapshot.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, label: true, authorName: true, createdAt: true } }),
    prisma.workspaceTask.findMany({ where: { workspaceId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    role === "MANAGER" ? prisma.workspaceMember.findMany({ where: { workspaceId }, include: { user: { select: { name: true, email: true } } } }) : [],
  ]);
  return { comments, snapshots, tasks, members };
}
export async function createWorkspaceSnapshot(workspaceId: string, label: string, generation: number) {
  await requireAccess(workspaceId, "edit");
  const user = await checkUser();
  if (!user) throw new Error("Sign in first");
  return prisma.$transaction(async tx => {
    await requireActiveAccount(tx, user.clerkId);
    await lockGeneration(tx, workspaceId, generation);
    const snapshot = await writeSnapshot(tx, workspaceId, z.string().trim().min(1).max(120).parse(label), user.name ?? "Team member", user.clerkId);
    return { id: snapshot.id };
  });
}
export async function restoreWorkspaceSnapshot(workspaceId: string, snapshotId: string, generation: number) {
  await requireAccess(workspaceId, "edit");
  const user = await checkUser();
  if (!user) throw new Error("Sign in first");
  await prisma.$transaction(async tx => { await requireActiveAccount(tx, user.clerkId); await lockGeneration(tx, workspaceId, generation); await restoreSnapshot(tx, workspaceId, snapshotId, user?.name ?? "Team member", user?.clerkId); });
  revalidatePath(`/workspace/${workspaceId}`);
}
const comment = z.object({ body: z.string().trim().min(1).max(4000), surface: z.enum(["WORKSPACE", "CANVAS", "DOC"]), anchorId: z.string().max(200).nullable() });
export async function addWorkspaceComment(workspaceId: string, input: z.infer<typeof comment>) {
  await requireAccess(workspaceId, "comment");
  const user = await checkUser();
  if (!user) throw new Error("Sign in first");
  const data = comment.parse(input);
  return prisma.$transaction(async tx => { await requireActiveAccount(tx, user.clerkId); return tx.workspaceComment.create({ data: { ...data, workspaceId, authorId: user.clerkId, authorName: user.name ?? "Team member" } }); });
}
export async function resolveWorkspaceComment(workspaceId: string, commentId: string, resolved: boolean) {
  await requireAccess(workspaceId, "comment");
  const { userId } = await auth();
  const item = await prisma.workspaceComment.findFirstOrThrow({ where: { id: commentId, workspaceId } });
  if (item.authorId !== userId && !(await canAccessWorkspace(workspaceId, "edit"))) throw new Error("Only the author or an editor can resolve this comment.");
  await prisma.workspaceComment.update({ where: { id: commentId }, data: { resolvedAt: resolved ? new Date() : null } });
}
export async function setWorkspaceMember(workspaceId: string, email: string, role: "VIEWER" | "COMMENTER" | "EDITOR") {
  await requireAccess(workspaceId, "manage");
  const validRole = z.enum(["VIEWER", "COMMENTER", "EDITOR"]).parse(role);
  const normalized = z.email().parse(email.trim().toLowerCase());
  const user = await prisma.user.findFirst({ where: { email: { equals: normalized, mode: "insensitive" } } });
  if (!user) throw new Error("Ask this person to sign in to DraftLane once, then add their email here.");
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { creatorId: true } });
  if (user.id === workspace.creatorId) throw new Error("The owner always has full access.");
  await prisma.workspaceMember.upsert({ where: { workspaceId_userId: { workspaceId, userId: user.id } }, create: { workspaceId, userId: user.id, role: validRole }, update: { role: validRole } });
}
export async function removeWorkspaceMember(workspaceId: string, memberId: string) {
  await requireAccess(workspaceId, "manage");
  await prisma.workspaceMember.deleteMany({ where: { id: memberId, workspaceId } });
}
const taskInput = z.object({ title: z.string().trim().min(1).max(240), description: z.string().max(5000).default(""), phase: z.string().trim().min(1).max(100).default("Implementation"), sourceKey: z.string().min(1).max(100).optional() });
export async function createWorkspaceTask(workspaceId: string, input: z.input<typeof taskInput>, generation: number) {
  await requireAccess(workspaceId, "edit");
  const data = taskInput.parse(input);
  return prisma.$transaction(async tx => {
    await lockGeneration(tx, workspaceId, generation);
    const position = await tx.workspaceTask.count({ where: { workspaceId } });
    if (data.sourceKey) return tx.workspaceTask.upsert({ where: { workspaceId_sourceKey: { workspaceId, sourceKey: data.sourceKey } }, create: { workspaceId, ...data, position }, update: { title: data.title, description: data.description, phase: data.phase } });
    return tx.workspaceTask.create({ data: { workspaceId, ...data, position } });
  });
}
export async function updateWorkspaceTask(workspaceId: string, taskId: string, status: "TODO" | "IN_PROGRESS" | "DONE", generation: number) {
  await requireAccess(workspaceId, "edit");
  const value = z.enum(["TODO", "IN_PROGRESS", "DONE"]).parse(status);
  await prisma.$transaction(async tx => { await lockGeneration(tx, workspaceId, generation); await tx.workspaceTask.updateMany({ where: { id: taskId, workspaceId }, data: { status: value } }); });
}
