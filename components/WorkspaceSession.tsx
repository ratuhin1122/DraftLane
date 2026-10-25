"use client";
import { createContext, useContext } from "react";
import type { WorkspaceRole } from "@/lib/workspace-permissions";
const Context = createContext({ generation: 0, role: "MANAGER" as WorkspaceRole });
export function WorkspaceSession({ generation, role, children }: { generation: number; role: WorkspaceRole; children: React.ReactNode }) {
  return <Context.Provider value={{ generation, role }}>{children}</Context.Provider>;
}
export function useWorkspaceSession() { return useContext(Context); }
