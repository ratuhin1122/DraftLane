"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteWorkspace } from "@/actions/workspace";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

export function DeleteWorkspaceButton({ workspaceId, name }: { workspaceId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function remove(event: React.MouseEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await deleteWorkspace(workspaceId);
      try {
        localStorage.removeItem(`draftlane:canvas:${workspaceId}`);
        localStorage.removeItem(`draftlane:doc:${workspaceId}`);
      } catch { /* Storage can be unavailable. The workspace has still been deleted. */ }
      setOpen(false);
      toast.success("Workspace deleted.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete workspace.");
    } finally { setPending(false); }
  }
  return (
    <AlertDialog open={open} onOpenChange={(value) => { if (!pending) setOpen(value); }}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Delete workspace ${name}`} title="Delete workspace" className="absolute top-2 right-2 z-10 size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>This permanently deletes the workspace, its document, and its canvas. This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={remove}>{pending ? "Deleting..." : "Delete workspace"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
