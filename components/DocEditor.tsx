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
import { useCollaborativeDoc } from "@/hooks/use-collaborative-doc";
import { useWorkspaceEditors } from "@/components/WorkspaceEditorsContext";
import type { SupabaseYjsProvider } from "@/lib/supabase-yjs-provider";
import { imageUploadProps } from "@/lib/image-upload";
import { writeDocDraft } from "@/lib/workspace-draft";
import { colorForUser } from "@/lib/utils";
import { WorkspaceSync } from "@/lib/workspace-sync";
import { permits } from "@/lib/workspace-permissions";
import { useWorkspaceSession } from "@/components/WorkspaceSession";
import { draftlaneDarkTheme } from "@/lib/blocknote-theme";


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
  const { generation, role } = useWorkspaceSession();
  const editable = permits(role, "edit");
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

  useEffect(() => {
    const sync = new WorkspaceSync(workspaceId, "doc", generation, doc, state => writeDocDraft(workspaceId, state, generation), !editable);
    return () => sync.destroy();
  }, [workspaceId, generation, doc, editable]);

  return (
    <div className="h-full overflow-y-auto pt-6">
      <BlockNoteView editable={editable} editor={editor} theme={draftlaneDarkTheme} />
    </div>
  );
}
