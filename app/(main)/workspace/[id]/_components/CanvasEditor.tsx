"use client";

import { useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Tldraw,
  useTLStore,
  atom,
  computed,
  createTLCurrentUser,
  createUserId,
  getUserPreferences,
  UserRecordType,
  DefaultToolbar,
  DefaultToolbarContent,
  type TLAssetStore,
  defaultShapeUtils,
  defaultBindingUtils,
  type Editor,
  type TLEditorSnapshot,
  type TLComponents,
} from "tldraw";
import { useSync } from "@tldraw/sync";
import { toast } from "sonner";
import "tldraw/tldraw.css";
import { saveCanvasContent } from "@/actions/canvas";
import type { Prisma } from "@/lib/generated/prisma/client";
import { EntityTableShapeUtil } from "@/components/EntityTable/EntityTableShapeUtil";
import { AddEntityTableButton } from "@/components/EntityTable/AddEntityTableButton";
import { snapArrowBindingToRow } from "@/components/EntityTable/snapArrowToRow";
import { useWorkspaceEditors } from "@/components/WorkspaceEditorsContext";
import { readCanvasDraft, writeCanvasDraft } from "@/lib/workspace-draft";
import { colorForUser } from "@/lib/utils";

const SAVE_DEBOUNCE_MS = 1000;

const shapeUtils = [EntityTableShapeUtil];

// Use the configured sync worker when available. Local development uses a local store
// with database autosave and browser draft recovery, without a temporary public room.
const SYNC_URL = process.env.NEXT_PUBLIC_TLDRAW_SYNC_URL?.trim();

// Unlike useSyncDemo, useSync doesn't add tldraw's built-in shapes itself. Built once here:
// a new array on every render would make useSync rebuild the store in a loop.
const syncShapeUtils = [...defaultShapeUtils, ...shapeUtils];

type SyncOptions = { roomId: string; workspaceId: string; users?: Parameters<typeof useSync>[0]["users"] };

// Both local and collaborative canvases use our authenticated upload endpoint.
function useWorkspaceAssets(workspaceId: string) {
  const assets = useMemo<TLAssetStore>(() => ({
    async upload(_asset, file) {
      const form = new FormData();
      form.set("file", file);
      form.set("workspaceId", workspaceId);
      const response = await fetch("/api/uploads", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Image upload failed.");
      return { src: new URL(result.url, window.location.origin).href };
    },
    resolve(asset) { return asset.props.src ?? null; },
  }), [workspaceId]);
  return assets;
}

function useRemoteCanvas({ roomId, workspaceId, users }: SyncOptions) {
  const assets = useWorkspaceAssets(workspaceId);
  return useSync({
    uri: `${SYNC_URL}/connect/${encodeURIComponent(roomId)}`,
    assets,
    shapeUtils: syncShapeUtils,
    bindingUtils: defaultBindingUtils,
    users,
  });
}

function useLocalCanvas({ workspaceId }: SyncOptions) {
  const assets = useWorkspaceAssets(workspaceId);
  return useTLStore({ assets, shapeUtils: syncShapeUtils, bindingUtils: defaultBindingUtils });
}

const useCanvasSync = SYNC_URL ? useRemoteCanvas : useLocalCanvas;

// A cleaner, single-page canvas: no style panel, page menu or main menu, and a vertical toolbar
// on the left with our Add table button.
const components: TLComponents = {
  StylePanel: null,
  PageMenu: null,
  MainMenu: null,
  Toolbar: () => (
    <DefaultToolbar orientation="vertical">
      <AddEntityTableButton />
      <DefaultToolbarContent />
    </DefaultToolbar>
  ),
};

export function CanvasEditor({
  workspaceId,
  initialSnapshot,
  initialSavedAt,
}: {
  workspaceId: string;
  initialSnapshot: TLEditorSnapshot | null;
  initialSavedAt: number;
}) {
  const { setCanvasEditor } = useWorkspaceEditors();
  const { user } = useUser();

  // Gives other collaborators this user's real name/avatar on their cursor instead of "New User".
  // Memoized on primitives because useSync reconnects whenever the users object changes.
  const userId = user?.id;
  const userName = user?.fullName ?? user?.username ?? "Anonymous";
  const userImageUrl = user?.imageUrl ?? "";
  const users = useMemo(() => {
    if (!userId) return undefined;
    return {
      currentUser: atom(
        "currentUser",
        UserRecordType.create({
          id: createUserId(userId),
          name: userName,
          color: colorForUser(userId),
          imageUrl: userImageUrl,
        })
      ),
    };
  }, [userId, userName, userImageUrl]);

  // The editor's own identity (people menu, your own cursor) is separate from what gets synced —
  // pin its name/color to Clerk too, keeping every other preference from tldraw's local storage.
  const currentUser = useMemo(() => {
    if (!userId) return undefined;
    return createTLCurrentUser({
      userPreferences: computed("clerkUserPreferences", () => ({
        ...getUserPreferences(),
        id: userId,
        name: userName,
        color: colorForUser(userId),
      })),
    });
  }, [userId, userName]);

  // The Postgres autosave below also re-seeds a room that starts empty.
  const store = useCanvasSync({ roomId: `outpost-${workspaceId}`, workspaceId, users });

  const handleMount = (editor: Editor) => {
    setCanvasEditor(editor);
    // Seed from Postgres only when the room is empty, so a joining user doesn't overwrite
    // what others have already drawn.
    const restored = readCanvasDraft(workspaceId, initialSavedAt) ?? initialSnapshot;
    if (restored && editor.getCurrentPageShapeIds().size === 0) {
      editor.loadSnapshot(restored);
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    let pending: Prisma.InputJsonValue | undefined;
    let queue = Promise.resolve();
    const flush = () => {
      clearTimeout(timeout);
      timeout = undefined;
      if (!pending) return;
      const snapshot = pending;
      pending = undefined;
      queue = queue.then(() => saveCanvasContent(workspaceId, snapshot)).catch(() => {
        toast.error("Canvas could not save. Please retry before leaving this workspace.");
      });
    };
    const stopSaving = editor.store.listen(() => {
      const snapshot = editor.getSnapshot();
      writeCanvasDraft(workspaceId, snapshot);
      pending = JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue;
      clearTimeout(timeout);
      timeout = setTimeout(flush, SAVE_DEBOUNCE_MS);
    }, { source: "user", scope: "document" });
    if (readCanvasDraft(workspaceId, initialSavedAt)) {
      pending = JSON.parse(JSON.stringify(editor.getSnapshot())) as Prisma.InputJsonValue;
      flush();
    }
    const onPageHide = () => flush();
    window.addEventListener("pagehide", onPageHide);

    // Arrows drawn onto an ERD table snap to the nearest row (see snapArrowToRow.ts).
    const stopSnapping = editor.store.listen(
      (entry) => {
        for (const record of Object.values(entry.changes.added)) {
          if (record.typeName === "binding" && record.type === "arrow") {
            snapArrowBindingToRow(editor, record);
          }
        }
      },
      { source: "user", scope: "all" }
    );

    // Clear it on unmount (e.g. switching to the Document view) so nothing keeps a disposed editor.
    return () => {
      stopSaving();
      stopSnapping();
      window.removeEventListener("pagehide", onPageHide);
      flush();
      setCanvasEditor(null);
    };
  };

  return (
    // isolate keeps tldraw's high z-index layers inside the canvas, so dialogs render above them.
    // The toolbar moves up into the space left by the hidden page menu (! beats tldraw.css).
    <div className="isolate h-full [&_.tlui-main-toolbar--vertical]:top-4!">
      <Tldraw
        store={store}
        user={currentUser}
        onMount={handleMount}
        components={components}
        colorScheme="dark"
        shapeUtils={shapeUtils}
        licenseKey={process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY}
      />
    </div>
  );
}
