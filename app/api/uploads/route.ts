import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { lockAccount } from "@/lib/account-deletion";
import { auth } from "@clerk/nextjs/server";
import { canAccessWorkspace } from "@/lib/workspace-access";

export const runtime = "nodejs";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in to upload images." }, { status: 401 });
  if (Number(request.headers.get("content-length")) > MAX_IMAGE_BYTES + 64 * 1024) {
    return Response.json({ error: "Choose an image smaller than 5 MB." }, { status: 413 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }
  const workspaceId = form.get("workspaceId");
  if (typeof workspaceId !== "string" || !(await canAccessWorkspace(workspaceId, "edit"))) {
    return Response.json({ error: "Workspace access required." }, { status: 403 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    return Response.json({ error: "Choose an image smaller than 5 MB." }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const extension = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? "png"
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? "jpg"
      : ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))
        ? "gif"
        : bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP"
          ? "webp"
          : null;
  if (!extension) return Response.json({ error: "Use a PNG, JPEG, GIF, or WebP image." }, { status: 415 });
  const directory = path.join(process.cwd(), "public", "uploads");
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}.${extension}`;
  await writeFile(path.join(directory, filename), bytes, { flag: "wx" });
  try {
    await prisma.$transaction(async tx => {
      await lockAccount(tx, userId);
      if (await tx.accountDeletion.findUnique({ where: { clerkId: userId } })) throw new Error("Account is being deleted");
      if (!(await tx.user.findUnique({ where: { clerkId: userId }, select: { id: true } }))) throw new Error("Account not found");
      await tx.uploadedAsset.create({ data: { filename, ownerClerkId: userId } });
    });
  } catch {
    await unlink(path.join(directory, filename)).catch(() => {});
    return Response.json({ error: "Upload could not be saved." }, { status: 503 });
  }
  return Response.json({ url: `/uploads/${filename}` }, { status: 201 });
}
