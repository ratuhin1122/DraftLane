"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import type { Editor } from "tldraw";
import type { BlockNoteEditor } from "@blocknote/core";
import { agentToolDefs, docToolDefs, taskToolDefs, fail, type ToolResult } from "@/lib/agent-tools";
import { PROMPT_LIMIT_ERROR, UPGRADE_REASONS } from "@/lib/plan-limits";
import { executeCanvasTool, summarizeCanvas, createDrawingPlacement, focusDrawing, type DrawingPlacement, type ShapeIdMap } from "@/lib/agent-canvas";
import { executeDocTool, summarizeDoc } from "@/lib/agent-doc";
import { useWorkspaceSession } from "@/components/WorkspaceSession";
import { createWorkspaceSnapshot, createWorkspaceTask, updateWorkspaceTask } from "@/actions/collaboration";
import { flushWorkspace } from "@/lib/workspace-events";
import { toast } from "sonner";
import { refreshPromptUsage } from "@/components/PlanButton";
import { useUpgradeDialog } from "@/components/UpgradeDialog";

type Editors = { canvasEditor: Editor | null; docEditor: BlockNoteEditor | null };

// Every call must produce an output (even a failure), or the chat waits on it forever.
function runTool({ canvasEditor, docEditor }: Editors, idMap: ShapeIdMap, toolName: string, input: unknown, placement: DrawingPlacement): ToolResult {
  try {
    if (toolName in docToolDefs) {
      return docEditor
        ? executeDocTool(docEditor, toolName, input)
        : fail("The doc isn't open in this view. Tell the user to switch to the Both or Document view.");
    }
    return canvasEditor
      ? executeCanvasTool(canvasEditor, idMap, toolName, input, placement)
      : fail("The canvas isn't open in this view. Tell the user to switch to the Both or Canvas view.");
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Tool failed");
  }
}

export function useWorkspaceAgentChat(workspaceId: string, editors: Editors) {
  const { generation } = useWorkspaceSession();
  const taskBatch = useRef("");
  const idMap = useRef<ShapeIdMap>(new Map());
  const placement = useRef<DrawingPlacement>(createDrawingPlacement());
  const openUpgrade = useUpgradeDialog();
  const editorsRef = useRef(editors);
  useEffect(() => {
    editorsRef.current = editors;
  });

  // Built once, so it reads the latest editors on each request: every request (including the
  // automatic follow-ups after tool calls) carries the current state of both surfaces.
  const [transport] = useState(
    // The ref is only read when a request is sent, never during render.
    // eslint-disable-next-line react-hooks/refs
    () =>
      new DefaultChatTransport({
        api: "/api/agent",
        body: () => {
          const { canvasEditor, docEditor } = editorsRef.current;
          return {
            workspaceId,
            canvasContext: canvasEditor ? summarizeCanvas(canvasEditor) : null,
            docContext: docEditor ? summarizeDoc(docEditor) : null,
          };
        },
      })
  );

  const chat = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onFinish: () => {
      refreshPromptUsage();
      if (editorsRef.current.canvasEditor) focusDrawing(editorsRef.current.canvasEditor, placement.current);
    },
    onError: (error) => {
      if (!error.message.includes(PROMPT_LIMIT_ERROR)) return;
      refreshPromptUsage();
      openUpgrade(UPGRADE_REASONS.prompts);
    },
    onToolCall: async ({ toolCall }) => {
      let taskOutput: ToolResult | undefined;
      try {
        if (toolCall.toolName === "createTask") {
          const input = taskToolDefs.createTask.inputSchema.parse(toolCall.input);
          await createWorkspaceTask(workspaceId, { title: input.title, description: input.description, phase: input.phase, sourceKey: `${taskBatch.current}:${input.id}` }, generation);
          taskOutput = { success: true };
        } else if (toolCall.toolName === "updateTaskStatus") {
          const input = taskToolDefs.updateTaskStatus.inputSchema.parse(toolCall.input);
          await updateWorkspaceTask(workspaceId, input.taskId, input.status, generation);
          taskOutput = { success: true };
        }
      } catch (error) { taskOutput = fail(error instanceof Error ? error.message : "Task action failed"); }
      const output = taskOutput ?? runTool(editorsRef.current, idMap.current, toolCall.toolName, toolCall.input, placement.current);
      // Not awaited: the SDK checks for the automatic resubmit right after this callback returns.
      chat.addToolOutput({
        tool: toolCall.toolName as keyof typeof agentToolDefs,
        toolCallId: toolCall.toolCallId,
        output,
      });
    },
  });

  const sendMessage: typeof chat.sendMessage = async (...args) => {
    try {
      await flushWorkspace(workspaceId);
      await createWorkspaceSnapshot(workspaceId, "Before AI changes", generation);
    } catch {
      toast.error("Reconnect and finish saving before asking the agent to change your workspace.");
      return;
    }
    taskBatch.current = crypto.randomUUID();
    placement.current = createDrawingPlacement();
    idMap.current.clear();
    return chat.sendMessage(...args);
  };
  return { ...chat, sendMessage };
}

export type WorkspaceAgentChat = ReturnType<typeof useWorkspaceAgentChat>;
