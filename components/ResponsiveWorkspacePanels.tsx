"use client";

import { useSyncExternalStore } from "react";
import { ResizablePanelGroup } from "@/components/ui/resizable";

const query = "(min-width: 1024px)";
function subscribe(callback: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
export function ResponsiveWorkspacePanels({ children }: { children: React.ReactNode }) {
  const wide = useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => true);
  return <ResizablePanelGroup orientation={wide ? "horizontal" : "vertical"} className="min-h-0 min-w-0 flex-1">{children}</ResizablePanelGroup>;
}
