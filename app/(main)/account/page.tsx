"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser, useClerk } from "@clerk/nextjs";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

type Receipt = { jobId: string; token: string };
const receiptKey = "draftlane:account-deletion";
export default function AccountPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [confirmation, setConfirmation] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    queueMicrotask(() => {
      try { const saved = sessionStorage.getItem(receiptKey); if (saved) setReceipt(JSON.parse(saved)); } catch { /* A fresh deletion request still works. */ }
    });
  }, []);
  useEffect(() => {
    if (!receipt) return;
    let cancelled = false;
    async function finish() {
      queueMicrotask(() => { if (!cancelled) { setBusy(true); setError(""); } });
      try {
        const response = await fetch("/api/account/delete/finish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(receipt) });
        const result = await response.json();
        if (!response.ok || !result.done) throw new Error(result.error ?? "Deletion could not finish. Please retry.");
        try {
          for (const key of Object.keys(localStorage)) if (key.startsWith("draftlane:")) localStorage.removeItem(key);
          sessionStorage.removeItem(receiptKey);
        } catch { /* Authentication and server data are deleted even when browser storage is unavailable. */ }
        await signOut().catch(() => {});
        window.location.replace("/?account-deleted=1");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not delete account.");
      } finally { if (!cancelled) setBusy(false); }
    }
    void finish();
    return () => { cancelled = true; };
  }, [receipt, retry, signOut]);
  async function begin(event: React.MouseEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation, accountId: user?.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not request deletion.");
      const next: Receipt = { jobId: result.jobId, token: result.token };
      setReceipt(next); setDialog(false);
      try { sessionStorage.setItem(receiptKey, JSON.stringify(next)); } catch { /* Continue in this tab when session storage is unavailable. */ }
    } catch (err) { setError(err instanceof Error ? err.message : "Could not request deletion."); setBusy(false); }
  }
  return <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
    <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Back to dashboard</Link>
    <h1 className="mt-5 text-3xl font-semibold">Account settings</h1>
    {!isLoaded && !receipt ? <p className="mt-6 text-muted-foreground">Loading account…</p> : !user && !receipt ? <p className="mt-6">Please <Link href="/sign-in" className="text-primary underline">sign in</Link> to manage your account.</p> : <section className="mt-8 space-y-4 rounded-xl border border-destructive/40 bg-card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-xl font-medium"><Trash2 className="size-5 text-destructive"/>Delete account permanently</h2>
      {user && <p className="break-all text-sm text-muted-foreground">Signed in as {user.primaryEmailAddress?.emailAddress}</p>}
      <p className="text-sm text-muted-foreground">This removes your Clerk login and DraftLane account, owned workspaces, documents, canvases, version history, tasks, comments, memberships, and uploaded images. Local DraftLane drafts in this browser are cleared.</p>
      <p className="text-sm text-muted-foreground">Workspaces owned by other people are not deleted. This cannot be undone.</p>
      {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
      {receipt ? <div className="space-y-3"><p role="status" className="text-sm">{busy ? "Deleting your account and completing cleanup…" : "Deletion is pending. Retry to finish removing your account data."}</p><Button variant="destructive" disabled={busy} onClick={()=>setRetry(value=>value+1)}>{busy && <Loader2 className="mr-2 size-4 animate-spin"/>}{busy ? "Deleting…" : "Retry deletion"}</Button></div> : <AlertDialog open={dialog} onOpenChange={value=>{if(!busy)setDialog(value);}}>
        <AlertDialogTrigger asChild><Button variant="destructive">Delete account permanently</Button></AlertDialogTrigger>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Permanently delete your account?</AlertDialogTitle><AlertDialogDescription>Your login and owned workspace data will be permanently removed. Type DELETE to confirm.</AlertDialogDescription></AlertDialogHeader>
          <Input aria-label="Type DELETE to confirm account deletion" autoComplete="off" value={confirmation} onChange={event=>setConfirmation(event.target.value)} placeholder="DELETE" disabled={busy}/>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busy || confirmation!=="DELETE"} onClick={begin}>{busy ? "Deleting…" : "Delete permanently"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>}
    </section>}
  </main>;
}
