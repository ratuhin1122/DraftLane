import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

export function deletionTokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function validDeletionToken(token: string, hash: string) {
  const actual = Buffer.from(deletionTokenHash(token), "hex");
  const expected = Buffer.from(hash, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
export async function lockAccount(tx: Prisma.TransactionClient, clerkId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${clerkId}))::text`;
}
export async function requireActiveAccount(tx: Prisma.TransactionClient, clerkId: string) {
  await lockAccount(tx, clerkId);
  if (await tx.accountDeletion.findUnique({ where: { clerkId } })) throw new Error("Account deletion is pending");
  if (!(await tx.user.findUnique({ where: { clerkId }, select: { id: true } }))) throw new Error("Account not found");
}
export async function startAccountDeletion(clerkId: string) {
  const token = randomBytes(32).toString("hex");
  const job = await prisma.$transaction(async tx => {
    await lockAccount(tx, clerkId);
    return tx.accountDeletion.upsert({ where: { clerkId }, create: { clerkId, tokenHash: deletionTokenHash(token) }, update: { tokenHash: deletionTokenHash(token) } });
  });
  return { jobId: job.id, token };
}
const uploadedFilename = /^[a-f0-9-]{36}\.(?:png|jpg|gif|webp)$/i;
function collectUploads(value: unknown, output: Set<string>) {
  if (typeof value === "string") {
    for (const match of value.matchAll(/\/uploads\/([a-f0-9-]{36}\.(?:png|jpg|gif|webp))/gi)) output.add(match[1]);
  } else if (Array.isArray(value)) value.forEach(item => collectUploads(item, output));
  else if (value && typeof value === "object") Object.values(value).forEach(item => collectUploads(item, output));
}
export async function purgeLocalAccountData(clerkId: string) {
  return prisma.$transaction(async tx => {
    await lockAccount(tx, clerkId);
    const user = await tx.user.findUnique({ where: { clerkId }, include: { createdWorkspaces: { include: { doc: true, canvas: true, snapshots: true } } } });
    const assets = await tx.uploadedAsset.findMany({ where: { ownerClerkId: clerkId } });
    const files = new Set(assets.map(asset => asset.filename));
    for (const workspace of user?.createdWorkspaces ?? []) {
      collectUploads(workspace.doc?.content, files); collectUploads(workspace.canvas?.content, files);
      workspace.snapshots.forEach(snapshot => { collectUploads(snapshot.docContent, files); collectUploads(snapshot.canvasContent, files); });
    }
    const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
    for (const file of files) {
      if (!uploadedFilename.test(file)) continue;
      const target = path.resolve(uploadsRoot, file);
      if (path.dirname(target) !== uploadsRoot) throw new Error("Invalid upload path");
      try { await unlink(target); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
    await tx.workspaceComment.deleteMany({ where: { authorId: clerkId } });
    await tx.workspaceSnapshot.updateMany({ where: { OR: [{ authorId: clerkId }, ...(user?.name ? [{ authorId: null, authorName: user.name }] : [])] }, data: { authorId: null, authorName: "Deleted account" } });
    await tx.uploadedAsset.deleteMany({ where: { ownerClerkId: clerkId } });
    const deleted = await tx.user.deleteMany({ where: { clerkId } });
    return { usersDeleted: deleted.count, uploadsDeleted: files.size };
  }, { timeout: 30000 });
}
export async function finishAccountDeletion(jobId: string, token: string, deleteIdentity: (clerkId: string) => Promise<void>) {
  const job = await prisma.accountDeletion.findUnique({ where: { id: jobId } });
  if (!job) return { done: true };
  if (!validDeletionToken(token, job.tokenHash)) throw new Error("Invalid deletion receipt");
  if (!job.providerDeleted) {
    await deleteIdentity(job.clerkId);
    await prisma.accountDeletion.updateMany({ where: { id: job.id }, data: { providerDeleted: true } });
  }
  await purgeLocalAccountData(job.clerkId);
  await prisma.accountDeletion.deleteMany({ where: { id: job.id } });
  return { done: true };
}
