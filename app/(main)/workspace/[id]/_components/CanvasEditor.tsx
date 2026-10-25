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
import type { useSync } from "@tldraw/sync";
import "tldraw/tldraw.css";
import { EntityTableShapeUtil } from "@/components/EntityTable/EntityTableShapeUtil";
import { AddEntityTableButton } from "@/components/EntityTable/AddEntityTableButton";
import { snapArrowBindingToRow } from "@/components/EntityTable/snapArrowToRow";
import { useWorkspaceEditors } from "@/components/WorkspaceEditorsContext";
import { attachCanvasSync } from "@/lib/canvas-collaboration";
import { permits } from "@/lib/workspace-permissions";
import { useWorkspaceSession } from "@/components/WorkspaceSession";
import { colorForUser } from "@/lib/utils";


const shapeUtils = [EntityTableShapeUtil];

// The editor always uses a local store. Authenticated per-record CRDT synchronization
// is attached after mount; keep shape utilities stable between renders.
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

function useCanvasSync({ workspaceId }: SyncOptions) {
  const assets = useWorkspaceAssets(workspaceId);
  return useTLStore({ assets, shapeUtils: syncShapeUtils, bindingUtils: defaultBindingUtils });
}

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
  initialState,
}: {
  workspaceId: string;
  initialSnapshot: TLEditorSnapshot | null;
  initialSavedAt: number;
  initialState: string | null;
}) {
  const { generation, role } = useWorkspaceSession();
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
    editor.updateInstanceState({ isReadonly: !permits(role, "edit") });
    // Seed from Postgres only when the room is empty, so a joining user doesn't overwrite
    // what others have already drawn.
    if (initialSnapshot && !editor.getCurrentPageShapeIds().size) editor.loadSnapshot(initialSnapshot);
    const stopSync = attachCanvasSync(editor, workspaceId, generation, initialState, initialSavedAt, !permits(role, "edit"));

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
      stopSync();
      stopSnapping();
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
