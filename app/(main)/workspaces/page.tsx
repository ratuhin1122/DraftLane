import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { checkUser } from "@/actions/check-user";
import { getWorkspaceRole } from "@/lib/workspace-access";
import { permits } from "@/lib/workspace-permissions";
import { prisma } from "@/lib/prisma";
import { getWorkspaceScope } from "@/lib/workspace-scope";
import { withLastActivity, workspaceCardSelect } from "@/lib/workspace-status";
import { Button } from "@/components/ui/button";
import { WorkspaceDialog } from "@/components/WorkspaceDialog";
import { WorkspaceBoard } from "./_components/WorkspaceBoard";

export default async function WorkspacesPage() {
  const user = await checkUser();
  if (!user) redirect("/sign-in");

  const { orgName, where } = await getWorkspaceScope(user.id);
  const workspaces = await prisma.workspace.findMany({
    where,
    select: { ...workspaceCardSelect, position: true },
    orderBy: { position: "asc" },
  });

  const cards = await Promise.all(workspaces.map(async workspace => { const role = await getWorkspaceRole(workspace.id); return { ...withLastActivity(workspace), canEdit: permits(role, "edit"), canDelete: permits(role, "manage") }; }));

  return (
    <div className="min-w-0 p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{orgName}</p>
          <h1 className="text-2xl font-semibold">All workspaces</h1>
        </div>
        <WorkspaceDialog
          trigger={
            <Button className="gap-2">
              <Plus className="size-4" />
              New workspace
            </Button>
          }
        />
      </div>

      {workspaces.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 py-16 text-center text-sm text-muted-foreground">
          No workspaces yet. Start one from the dashboard or with New workspace.
        </p>
      ) : (
        <WorkspaceBoard workspaces={cards} />
      )}
    </div>
  );
}
