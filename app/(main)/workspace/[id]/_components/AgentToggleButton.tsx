"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentChatPanel } from "./AgentChatPanel";
import { useWorkspaceEditors } from "@/components/WorkspaceEditorsContext";
import { useWorkspaceAgentChat } from "@/hooks/use-workspace-agent-chat";

// Owns the open/closed state for the agent chat panel — needs a client boundary since
// page.tsx is a server component, so this is the button plus the panel it toggles. The chat
// itself is created here (not inside AgentChatPanel) and kept mounted even while closed, so
// closing/reopening the panel doesn't wipe the conversation.
export function AgentToggleButton({ workspaceId, initialPrompt }: { workspaceId: string; initialPrompt?: string }) {
  const [isOpen, setIsOpen] = useState(!!initialPrompt);
  const { canvasEditor, docEditor } = useWorkspaceEditors();
  const chat = useWorkspaceAgentChat(workspaceId, { canvasEditor, docEditor });
  const router = useRouter();
  const pathname = usePathname();
  const promptSent = useRef(false);

  // A prompt from the dashboard is sent once both editors are ready, so the agent sees both
  // surfaces. It's then dropped from the URL so a refresh doesn't send it again.
  useEffect(() => {
    if (!initialPrompt || promptSent.current || !canvasEditor || !docEditor) return;
    promptSent.current = true;
    chat.sendMessage({ text: initialPrompt });
    router.replace(pathname, { scroll: false });
  }, [initialPrompt, canvasEditor, docEditor, chat, router, pathname]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail.workspaceId !== workspaceId) return;
      setIsOpen(true);
      void chat.sendMessage({ text: detail.prompt });
    };
    window.addEventListener("draftlane:agent-request", handler);
    return () => window.removeEventListener("draftlane:agent-request", handler);
  }, [workspaceId, chat]);

  return (
    <>
      <Button size="sm" aria-label={isOpen ? "Close agent" : "Ask Agent"} className="h-9 gap-1.5 px-2 sm:px-3" onClick={() => setIsOpen((v) => !v)}>
        {isOpen ? (
          <>
            <X className="size-4" />
            <span className="hidden sm:inline">Close</span>
          </>
        ) : (
          <>
            <Image src="/brand/mascot.png" alt="" width={16} height={16} className="size-4" />
            <span className="hidden sm:inline">Ask Agent</span>
          </>
        )}
      </Button>
      {isOpen && <AgentChatPanel chat={chat} isReady={!!canvasEditor || !!docEditor} />}
    </>
  );
}
