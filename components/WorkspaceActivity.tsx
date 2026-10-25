"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { History, MessageSquare, ListTodo, Users, Check, RotateCcw, Plus, Trash2, LocateFixed, Sparkles, Activity } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { getWorkspaceActivity, addWorkspaceComment, resolveWorkspaceComment, createWorkspaceSnapshot, restoreWorkspaceSnapshot, setWorkspaceMember, removeWorkspaceMember, createWorkspaceTask, updateWorkspaceTask } from "@/actions/collaboration";
import { useWorkspaceSession } from "@/components/WorkspaceSession";
import { useWorkspaceEditors } from "@/components/WorkspaceEditorsContext";
import { permits, type WorkspaceRole } from "@/lib/workspace-permissions";
import { flushWorkspace, type SyncStatus } from "@/lib/workspace-events";
import type { TLShapeId } from "tldraw";

type ActivityData = Awaited<ReturnType<typeof getWorkspaceActivity>>;
type Tab = "comments" | "history" | "tasks" | "access";
export function WorkspaceActivity({ workspaceId, role }: { workspaceId: string; role: WorkspaceRole }) {
  const router = useRouter();
  const { generation } = useWorkspaceSession();
  const { canvasEditor, docEditor } = useWorkspaceEditors();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("comments");
  const [data, setData] = useState<ActivityData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [anchor, setAnchor] = useState<{ surface: "WORKSPACE" | "CANVAS" | "DOC"; anchorId: string | null }>({ surface: "WORKSPACE", anchorId: null });
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"VIEWER" | "COMMENTER" | "EDITOR">("VIEWER");
  const [taskTitle, setTaskTitle] = useState("");
  const [restore, setRestore] = useState<{id: string; label: string} | null>(null);
  const [sync, setSync] = useState<Record<string, SyncStatus>>({});
  const load = useCallback(async () => {
    try { setData(await getWorkspaceActivity(workspaceId)); setError(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load workspace activity"); }
  }, [workspaceId]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fetchData = () => { if (!cancelled) void load(); };
    fetchData(); const timer = setInterval(fetchData, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [open, load]);
  useEffect(() => {
    const handler = (event: Event) => { const detail = (event as CustomEvent).detail; if (detail.workspaceId === workspaceId) setSync(previous => ({ ...previous, [detail.surface]: detail.status })); };
    window.addEventListener("draftlane:sync-status", handler);
    return () => window.removeEventListener("draftlane:sync-status", handler);
  }, [workspaceId]);
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try { await action(); await load(); } catch (err) { toast.error(err instanceof Error ? err.message : "Action failed"); }
    finally { setBusy(false); }
  }
  function selectAnchor(surface: "CANVAS" | "DOC") {
    const id = surface === "CANVAS" ? canvasEditor?.getSelectedShapeIds()[0] : docEditor?.getTextCursorPosition().block.id;
    if (!id) { toast.info(surface === "CANVAS" ? "Select a canvas object first." : "Place your cursor in a document block first."); return; }
    setAnchor({ surface, anchorId: id });
  }
  function locate(comment: ActivityData["comments"][number]) {
    if (!comment.anchorId) return;
    setOpen(false);
    router.push(`/workspace/${workspaceId}?view=${comment.surface === "CANVAS" ? "canvas" : "doc"}`, { scroll: false });
    setTimeout(() => {
      if (comment.surface === "CANVAS" && canvasEditor?.getShape(comment.anchorId as TLShapeId)) {
        canvasEditor.select(comment.anchorId as TLShapeId); canvasEditor.zoomToSelection();
      } else if (comment.surface === "DOC" && docEditor?.getBlock(comment.anchorId!)) {
        docEditor.setTextCursorPosition(comment.anchorId!); docEditor.focus();
      } else toast.info("The referenced object has been removed.");
    }, 300);
  }
  function askAgent(prompt: string) {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("draftlane:agent-request", { detail: { workspaceId, prompt } }));
  }
  const statuses = Object.values(sync);
  const syncText = statuses.includes("offline") ? "Offline · edits kept locally" : statuses.includes("error") ? "Retrying sync…" : statuses.includes("saving") ? "Saving…" : statuses.length ? "Saved" : "Connecting…";
  const tabs = [{ id:"comments" as const, label:"Comments", icon:MessageSquare },{ id:"history" as const, label:"History", icon:History },{ id:"tasks" as const,label:"Tasks",icon:ListTodo },...(role === "MANAGER" ? [{id:"access" as const,label:"Access",icon:Users}] : [])];
  return <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm" aria-label="Workspace activity" title={syncText} className="h-9 gap-1.5 px-2 sm:px-3"><Activity className={`size-4 ${statuses.includes("offline") || statuses.includes("error") ? "text-amber-400" : statuses.includes("saving") ? "animate-pulse text-primary" : ""}`}/><span className="hidden xl:inline">Activity</span></Button></DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Workspace activity</DialogTitle></DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span role="status">{syncText}</span><span>{role === "MANAGER" ? "Owner / manager" : role.toLowerCase()} access</span></div>
        <div className="flex gap-1 overflow-x-auto border-b border-border pb-2">{tabs.map(({id,label: title,icon:Icon}) => <Button key={id} size="sm" variant={tab===id ? "secondary":"ghost"} onClick={()=>setTab(id)} className="shrink-0 gap-1.5"><Icon className="size-4"/>{title}</Button>)}</div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!data && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
        {tab === "comments" && <div className="space-y-4">
          {permits(role,"comment") && <form className="space-y-2" onSubmit={e=>{e.preventDefault();void run(async()=>{await addWorkspaceComment(workspaceId,{...anchor,body});setBody("");});}}>
            <textarea aria-label="Comment" value={body} onChange={e=>setBody(e.target.value)} maxLength={4000} rows={3} placeholder="Discuss this workspace or attach a comment to a selected object…" className="w-full rounded-md border border-input bg-transparent p-3 text-base"/>
            <div className="flex flex-wrap items-center gap-2"><Button type="button" size="sm" variant="outline" onClick={()=>selectAnchor("CANVAS")}>Selected shape</Button><Button type="button" size="sm" variant="outline" onClick={()=>selectAnchor("DOC")}>Document block</Button><Button type="button" size="sm" variant="ghost" onClick={()=>setAnchor({surface:"WORKSPACE",anchorId:null})}>Whole workspace</Button></div>
            <p className="text-xs text-muted-foreground">Attached to: {anchor.surface.toLowerCase()}{anchor.anchorId ? ` · ${anchor.anchorId}` : ""}</p>
            <Button disabled={busy || !body.trim()}>Post comment</Button>
          </form>}
          {!permits(role,"comment") && <p className="text-sm text-muted-foreground">Ask the owner for Commenter access to join the discussion.</p>}
          {data?.comments.map(comment=><article key={comment.id} className={`rounded-lg border border-border p-3 ${comment.resolvedAt ? "opacity-60":""}`}><div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{comment.authorName} · {new Date(comment.createdAt).toLocaleString()}</span><span>{comment.resolvedAt ? "Resolved":"Open"}</span></div><p className="whitespace-pre-wrap break-words text-sm">{comment.body}</p><div className="mt-2 flex flex-wrap gap-2">{comment.anchorId && <Button size="sm" variant="ghost" onClick={()=>locate(comment)}><LocateFixed className="mr-1 size-3"/>Show reference</Button>}{permits(role,"comment") && <Button size="sm" variant="ghost" disabled={busy} onClick={()=>void run(()=>resolveWorkspaceComment(workspaceId,comment.id,!comment.resolvedAt))}><Check className="mr-1 size-3"/>{comment.resolvedAt ? "Reopen":"Resolve"}</Button>}</div></article>)}
          {data && !data.comments.length && <p className="text-sm text-muted-foreground">No comments yet.</p>}
        </div>}
        {tab === "history" && <div className="space-y-3">{permits(role,"edit") && <form className="flex gap-2" onSubmit={e=>{e.preventDefault();void run(async()=>{await flushWorkspace(workspaceId);await createWorkspaceSnapshot(workspaceId,label.trim()||"Manual snapshot",generation);setLabel("");});}}><Input value={label} onChange={e=>setLabel(e.target.value)} maxLength={120} placeholder="Version name" aria-label="Version name"/><Button disabled={busy}>Save version</Button></form>}<p className="text-xs text-muted-foreground">Automatic checkpoints are kept during editing and before AI changes. Restoring creates a backup first.</p>{data?.snapshots.map(snapshot=><div key={snapshot.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{snapshot.label}</p><p className="text-xs text-muted-foreground">{snapshot.authorName} · {new Date(snapshot.createdAt).toLocaleString()}</p></div>{permits(role,"edit") && <Button variant="outline" size="sm" disabled={busy} onClick={()=>setRestore(snapshot)}><RotateCcw className="mr-1 size-3"/>Restore</Button>}</div>)}{data && !data.snapshots.length && <p className="text-sm text-muted-foreground">Your first saved edits create an automatic checkpoint.</p>}</div>}
        {tab === "tasks" && <div className="space-y-3">{permits(role,"edit") && <><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={()=>askAgent("Turn the current canvas into a phased roadmap. Write the roadmap in the document and use createTask for each concrete implementation task, grouped by phase. Preserve existing canvas artwork.")}><Sparkles className="mr-1 size-3"/>Canvas → roadmap</Button><Button variant="outline" size="sm" onClick={()=>askAgent("Extract concrete implementation tasks from the current canvas and document. Use createTask for each task, with a clear title, description, and phase. Do not redraw the canvas.")}>Extract tasks</Button></div><form className="flex gap-2" onSubmit={e=>{e.preventDefault();void run(async()=>{await createWorkspaceTask(workspaceId,{title:taskTitle},generation);setTaskTitle("");});}}><Input aria-label="Task title" placeholder="Add a task…" value={taskTitle} maxLength={240} onChange={e=>setTaskTitle(e.target.value)}/><Button aria-label="Add task" disabled={busy || !taskTitle.trim()}><Plus className="size-4"/></Button></form></>}{data?.tasks.map(task=><article className="rounded-lg border border-border p-3" key={task.id}><p className="text-xs text-primary">{task.phase}</p><p className="mt-1 break-words text-sm font-medium">{task.title}</p>{task.description && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">{task.description}</p>}<select aria-label={`Status for ${task.title}`} value={task.status} disabled={busy || !permits(role,"edit")} onChange={e=>void run(()=>updateWorkspaceTask(workspaceId,task.id,e.target.value as "TODO"|"IN_PROGRESS"|"DONE",generation))} className="mt-2 rounded-md border border-input bg-background p-2 text-sm"><option value="TODO">To do</option><option value="IN_PROGRESS">In progress</option><option value="DONE">Done</option></select></article>)}{data && !data.tasks.length && <p className="text-sm text-muted-foreground">No implementation tasks yet. Extract them from your board or add one above.</p>}</div>}
        {tab === "access" && role === "MANAGER" && <div className="space-y-3"><p className="text-sm text-muted-foreground">Add someone who has already signed in to DraftLane. They will find this workspace on their dashboard. This does not send an email.</p><form className="flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();void run(async()=>{await setWorkspaceMember(workspaceId,email,memberRole);setEmail("");});}}><Input type="email" aria-label="Member email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="person@example.com" className="min-w-0 flex-1 basis-40"/><select aria-label="Access level" value={memberRole} onChange={e=>setMemberRole(e.target.value as typeof memberRole)} className="rounded-md border border-input bg-background px-2"><option value="VIEWER">Viewer</option><option value="COMMENTER">Commenter</option><option value="EDITOR">Editor</option></select><Button disabled={busy}>Grant access</Button></form><p className="text-xs text-muted-foreground">Viewer: read only. Commenter: read and discuss. Editor: edit content, tasks and versions. Owner: manages access. Organization access still applies to team members.</p>{data?.members.map(member=><div className="flex items-center justify-between gap-2 rounded-lg border border-border p-3" key={member.id}><div className="min-w-0"><p className="truncate text-sm">{member.user.name ?? member.user.email}</p><p className="break-all text-xs text-muted-foreground">{member.user.email} · {member.role.toLowerCase()}</p></div><Button variant="ghost" size="icon" aria-label={`Remove access for ${member.user.email}`} disabled={busy} onClick={()=>void run(()=>removeWorkspaceMember(workspaceId,member.id))}><Trash2 className="size-4"/></Button></div>)}</div>}
      </DialogContent>
    </Dialog>
    <AlertDialog open={!!restore} onOpenChange={value=>{if(!value&&!busy)setRestore(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Restore this version?</AlertDialogTitle><AlertDialogDescription>The document, canvas and tasks will return to “{restore?.label}”. The current state is backed up first. Connected editors will reload.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event=>{event.preventDefault();void run(async()=>{if(!restore)return;await flushWorkspace(workspaceId);await restoreWorkspaceSnapshot(workspaceId,restore.id,generation);window.location.reload();});}}>Restore version</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
