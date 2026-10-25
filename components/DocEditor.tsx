"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";
import * as Y from "yjs";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import type { Block, BlockNoteEditor } from "@blocknote/core";
import { CollaborationExtension } from "@blocknote/core/yjs";
import { saveDocContent } from "@/actions/doc";
import type { Prisma } from "@/lib/generated/prisma/client";
import { useCollaborativeDoc } from "@/hooks/use-collaborative-doc";
import { useWorkspaceEditors } from "@/components/WorkspaceEditorsContext";
import type { SupabaseYjsProvider } from "@/lib/supabase-yjs-provider";
import { imageUploadProps } from "@/lib/image-upload";
import { writeDocDraft } from "@/lib/workspace-draft";
import { toBase64 } from "@/lib/base64";
import { colorForUser } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { draftlaneDarkTheme } from "@/lib/blocknote-theme";

const SAVE_DEBOUNCE_MS = 1000;

type DocEditorProps = {
  workspaceId: string;
  initialContent: Block[] | null;
  initialState: string | null;
};

export function DocEditor({ workspaceId, initialContent, initialState }: DocEditorProps) {
  const { user } = useUser();
  const collab = useCollaborativeDoc(workspaceId, initialState);

  if (!collab || !user) {
    return <div className="p-6 text-sm text-muted-foreground">Loading document...</div>;
  }

  return (
    <CollaborativeEditor
      workspaceId={workspaceId}
      initialContent={initialContent}
      doc={collab.doc}
      provider={collab.provider}
      user={{ name: user.fullName ?? user.username ?? "Anonymous", color: colorForUser(user.id) }}
    />
  );
}

// Split out so the editor is only created once the shared doc is ready — BlockNote binds to
// the Yjs fragment at creation time.
function CollaborativeEditor({
  workspaceId,
  initialContent,
  doc,
  provider,
  user,
}: Omit<DocEditorProps, "initialState"> & {
  doc: Y.Doc;
  provider: SupabaseYjsProvider;
  user: { name: string; color: string };
}) {
  const fragment = doc.getXmlFragment("document-store");
  const uploadEditorRef = useRef<BlockNoteEditor | null>(null);
  const editor = useCreateBlockNote({
    uploadFile: async (file: File, blockId?: string) => {
      const currentEditor = uploadEditorRef.current;
      const before = blockId ? currentEditor?.getBlock(blockId) : undefined;
      const previousProps = before?.type === "image" ? before.props : undefined;
      const element = blockId ? currentEditor?.domElement?.querySelector(`[data-id="${CSS.escape(blockId)}"] .bn-file-block-content-wrapper`) : null;
      const placeholderWidth = previousProps?.previewWidth ?? element?.getBoundingClientRect().width;
      try {
        const form = new FormData();
        form.set("file", file);
        form.set("workspaceId", workspaceId);
        const response = await fetch("/api/uploads", { method: "POST", body: form });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Image upload failed.");
        const latest = blockId ? currentEditor?.getBlock(blockId) : undefined;
        if (latest?.type === "image") {
          return { props: imageUploadProps(latest.props, result.url as string, file.name, placeholderWidth) };
        }
        return result.url as string;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Image upload failed.");
        throw error;
      }
    },
    extensions: [CollaborationExtension({ fragment, user, provider })],
  });

  // Publish the live editor so the Share dialog can export it.
  const { setDocEditor } = useWorkspaceEditors();
  useEffect(() => {
    uploadEditorRef.current = editor;
    setDocEditor(editor);
    return () => {
      uploadEditorRef.current = null;
      setDocEditor(null);
    };
  }, [editor, setDocEditor]);

  // Docs saved before collaboration existed only have JSON — import it once into the shared doc.
  useEffect(() => {
    if (fragment.length === 0 && initialContent?.length) {
      editor.replaceBlocks(editor.document, initialContent);
    }
  }, [editor, fragment, initialContent]);

  // Save only our own edits (remote ones are saved by whoever made them). The server merges
  // the state, and also keeps a readable JSON copy for server-side features.
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      timeout = undefined;
      const content = JSON.parse(JSON.stringify(editor.document)) as Prisma.InputJsonValue;
      saveDocContent(workspaceId, toBase64(Y.encodeStateAsUpdate(doc)), content).catch(() => {
        toast.error("Document could not save. Please retry before leaving this workspace.");
      });
    };
    const handleUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin === provider) return;
      writeDocDraft(workspaceId, toBase64(Y.encodeStateAsUpdate(doc)));
      clearTimeout(timeout);
      timeout = setTimeout(save, SAVE_DEBOUNCE_MS);
    };

    doc.on("update", handleUpdate);
    timeout = setTimeout(save, SAVE_DEBOUNCE_MS);
    const pageHide = () => save();
    window.addEventListener("pagehide", pageHide);
    return () => {
      doc.off("update", handleUpdate);
      window.removeEventListener("pagehide", pageHide);
      // Flush a pending save rather than dropping the last edits when leaving the page.
      if (timeout) {
        clearTimeout(timeout);
        save();
      }
    };
  }, [doc, editor, provider, workspaceId]);

  return (
    <div className="h-full overflow-y-auto pt-6">
      {!supabase && (
        <p role="status" className="mx-6 mb-4 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Your edits are saved. Live collaboration is unavailable until Supabase is configured.
        </p>
      )}
      <BlockNoteView editor={editor} theme={draftlaneDarkTheme} />
    </div>
  );
}
