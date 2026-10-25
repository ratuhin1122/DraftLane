import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Block } from "@blocknote/core";
import type { TLEditorSnapshot } from "tldraw";
import { prisma } from "@/lib/prisma";
import { getWorkspaceRole } from "@/lib/workspace-access";
import { Button } from "@/components/ui/button";
import { EditableWorkspaceName } from "./_components/EditableWorkspaceName";
import { DocEditor } from "@/components/DocEditorLoader";
import { CanvasEditor } from "./_components/CanvasEditor";
import { AgentToggleButton } from "./_components/AgentToggleButton";
import { ShareDialog } from "./_components/ShareDialog";
import { getEntitlements, workspaceOwnerId, workspaceOwnerSelect } from "@/lib/billing";
import { PlanButton } from "@/components/PlanButton";
import { ResponsiveWorkspacePanels } from "@/components/ResponsiveWorkspacePanels";
import { WorkspaceActivity } from "@/components/WorkspaceActivity";
import { WorkspaceSession } from "@/components/WorkspaceSession";
import { permits } from "@/lib/workspace-permissions";
import { ensureCanvasState, ensureDocState } from "@/lib/workspace-persistence";
import { WorkspaceEditorsProvider } from "@/components/WorkspaceEditorsContext";
import {
  ResizableHandle,
  ResizablePanel,
} from "@/components/ui/resizable";

type ViewMode = "doc" | "canvas" | "both";

function parseViewMode(value: string | string[] | undefined): ViewMode {
  return value === "doc" || value === "canvas" ? value : "both";
}

export default async function WorkspacePage({
  params,
  searchParams,
}: PageProps<"/workspace/[id]">) {
  const { id } = await params;
  const { view: viewParam, prompt } = await searchParams;
  const view = parseViewMode(viewParam);

  // 404 rather than 403 so outsiders can't tell whether a workspace id exists.
  const role = await getWorkspaceRole(id);
  if (!role) notFound();
  await Promise.all([ensureCanvasState(id), ensureDocState(id)]);

  const workspace = await prisma.workspace.findUnique({
    where: { id },
    select: {
      name: true,
      generation: true,
      shareToken: true,
      ...workspaceOwnerSelect,
      doc: { select: { content: true, yjsState: true } },
      canvas: { select: { content: true, updatedAt: true, yjsState: true } },
    },
  });
  if (!workspace) notFound();
  const entitlements = await getEntitlements(workspaceOwnerId(workspace));

  const showDoc = view === "doc" || view === "both";
  const showCanvas = view === "canvas" || view === "both";

  return (
    // Lets header UI (agent panel, Share dialog) reach the live doc and canvas editors.
    <WorkspaceSession generation={workspace.generation} role={role}>
    <WorkspaceEditorsProvider>
      <div className="flex h-dvh flex-col overflow-hidden">
        {/* Logo (back to dashboard) and name left, view switcher centered, actions right. */}
        <header className="grid h-28 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 border-b border-white/6 bg-background px-3 lg:flex lg:h-14 lg:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 lg:gap-3">
            <Link
              href="/dashboard"
              className="flex size-8 shrink-0 items-center justify-center rounded-md transition-opacity hover:opacity-80"
            >
              <Image
                src="/brand/mascot-dark.png"
                alt="Back to dashboard"
                width={24}
                height={24}
                className="size-6"
              />
            </Link>
            {permits(role, "edit") ? <EditableWorkspaceName workspaceId={id} initialName={workspace.name} /> : <span className="min-w-0 truncate text-sm">{workspace.name}</span>}
          </div>

          <div className="order-3 col-span-2 mx-auto flex items-center gap-1 rounded-lg lg:order-none border border-white/10 bg-white/3 p-1">
            {(["doc", "both", "canvas"] as const).map((mode) => (
              <Button
                key={mode}
                asChild
                variant={view === mode ? "secondary" : "ghost"}
                size="sm"
                className="h-10 px-5 capitalize lg:h-8 lg:px-3"
              >
                <Link prefetch={false} href={mode === "both" ? `/workspace/${id}` : `/workspace/${id}?view=${mode}`}>
                  {mode === "doc" ? "Document" : mode}
                </Link>
              </Button>
            ))}
          </div>

          <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-2 lg:flex-1">
            <div className="hidden sm:block"><PlanButton upgradeOnlyWhenOut /></div>
            <WorkspaceActivity workspaceId={id} role={role} />
            {permits(role, "manage") && <ShareDialog
              workspaceId={id}
              workspaceName={workspace.name}
              initialShareToken={workspace.shareToken}
              canShare={entitlements.publicSharing}
              canExportPdf={entitlements.pdfExport}
            />}
            {permits(role, "edit") && <AgentToggleButton workspaceId={id} initialPrompt={typeof prompt === "string" ? prompt : undefined} />}
          </div>
        </header>

        {/* Keep both editors mounted when switching views so unsaved state survives. */}
        <ResponsiveWorkspacePanels>
          <ResizablePanel defaultSize="40%" minSize="20%" className={showDoc ? "" : "hidden"}>
              <DocEditor
                key={id}
                workspaceId={id}
                initialContent={workspace.doc?.content as Block[] | null}
                initialState={
                  workspace.doc?.yjsState ? Buffer.from(workspace.doc.yjsState).toString("base64") : null
                }
              />
          </ResizablePanel>
          <ResizableHandle withHandle className={showDoc && showCanvas ? "" : "hidden"} />
          <ResizablePanel defaultSize="60%" minSize="20%" className={showCanvas ? "" : "hidden"}>
              <CanvasEditor
                key={id}
                workspaceId={id}
                initialSnapshot={workspace.canvas?.content as TLEditorSnapshot | null}
                initialSavedAt={workspace.canvas?.updatedAt.getTime() ?? 0}
                initialState={workspace.canvas?.yjsState ? Buffer.from(workspace.canvas.yjsState).toString("base64") : null}
              />
          </ResizablePanel>
        </ResponsiveWorkspacePanels>
      </div>
    </WorkspaceEditorsProvider>
    </WorkspaceSession>
  );
}
