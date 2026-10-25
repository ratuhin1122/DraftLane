"use server";
import { canAccessWorkspace } from "@/lib/workspace-access";
import { persistDoc } from "@/lib/workspace-persistence";
import type { Prisma } from "@/lib/generated/prisma/client";
export async function saveDocContent(workspaceId: string, yjsState: string, _content: Prisma.InputJsonValue, generation = 0) {
  if (!(await canAccessWorkspace(workspaceId, "edit"))) throw new Error("Editing permission required");
  return persistDoc(workspaceId, Buffer.from(yjsState, "base64"), generation);
}
