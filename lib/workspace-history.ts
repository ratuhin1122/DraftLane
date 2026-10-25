import { Prisma } from "@/lib/generated/prisma/client";
export async function writeSnapshot(tx: Prisma.TransactionClient, workspaceId: string, label: string, authorName: string, authorId?: string) {
  const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId }, include: { doc: true, canvas: true, tasks: { orderBy: { position: "asc" } } } });
  return tx.workspaceSnapshot.create({ data: {
    workspaceId, label, authorName, authorId, generation: workspace.generation,
    docContent: workspace.doc?.content ?? Prisma.DbNull, docState: workspace.doc?.yjsState,
    canvasContent: workspace.canvas?.content ?? Prisma.DbNull, canvasState: workspace.canvas?.yjsState,
    tasks: JSON.parse(JSON.stringify(workspace.tasks)),
  } });
}
export async function maybeCheckpoint(tx: Prisma.TransactionClient, workspaceId: string) {
  const latest = await tx.workspaceSnapshot.findFirst({ where: { workspaceId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (!latest || Date.now() - latest.createdAt.getTime() > 5 * 60 * 1000) await writeSnapshot(tx, workspaceId, "Automatic checkpoint", "DraftLane");
}

export async function restoreSnapshot(tx: Prisma.TransactionClient, workspaceId: string, snapshotId: string, authorName: string, authorId?: string) {
  await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${workspaceId} FOR UPDATE`;
  const snapshot = await tx.workspaceSnapshot.findFirstOrThrow({ where: { id: snapshotId, workspaceId } });
  await writeSnapshot(tx, workspaceId, "Before restoring a version", authorName, authorId);
  await tx.workspace.update({ where: { id: workspaceId }, data: { generation: { increment: 1 } } });
  await tx.doc.update({ where: { workspaceId }, data: { content: snapshot.docContent ?? Prisma.DbNull, yjsState: snapshot.docState } });
  await tx.canvas.update({ where: { workspaceId }, data: { content: snapshot.canvasContent ?? Prisma.DbNull, yjsState: snapshot.canvasState } });
  const tasks = snapshot.tasks as { id: string; title: string; description: string; phase: string; status: string; sourceKey: string | null; position: number }[] | null;
  await tx.workspaceTask.deleteMany({ where: { workspaceId } });
  if (tasks?.length) await tx.workspaceTask.createMany({ data: tasks.map(task => ({ id: task.id, workspaceId, title: task.title, description: task.description, phase: task.phase, status: task.status, sourceKey: task.sourceKey, position: task.position })) });
}
