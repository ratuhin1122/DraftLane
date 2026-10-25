import { canAccessWorkspace } from "@/lib/workspace-access";
import { prisma } from "@/lib/prisma";
import { ensureCanvasState, persistCanvas, persistDoc, STALE_WORKSPACE } from "@/lib/workspace-persistence";
import { z } from "zod";
const input = z.object({ surface: z.enum(["doc", "canvas"]), state: z.string().min(1).max(8_000_000), generation: z.number().int().nonnegative() });
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await canAccessWorkspace(id))) return new Response("Workspace not found", { status: 404 });
  await ensureCanvasState(id);
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id }, select: { generation: true, doc: { select: { yjsState: true } }, canvas: { select: { yjsState: true } } } });
  return Response.json({ generation: workspace.generation, doc: workspace.doc?.yjsState ? Buffer.from(workspace.doc.yjsState).toString("base64") : null, canvas: workspace.canvas?.yjsState ? Buffer.from(workspace.canvas.yjsState).toString("base64") : null }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await canAccessWorkspace(id, "edit"))) return new Response("Editing permission required", { status: 403 });
  if (Number(request.headers.get("content-length")) > 8_100_000) return new Response("State too large", { status: 413 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response("Invalid sync state", { status: 400 });
  try {
    const data = parsed.data;
    const state = Buffer.from(data.state, "base64");
    const saved = await (data.surface === "canvas" ? persistCanvas : persistDoc)(id, state, data.generation);
    return Response.json(saved);
  } catch (error) {
    if (error instanceof Error && error.message === STALE_WORKSPACE) return new Response(STALE_WORKSPACE, { status: 409 });
    console.error("Workspace sync failed", error instanceof Error ? error.name : "Unknown error");
    return new Response("Could not sync workspace", { status: 500 });
  }
}
