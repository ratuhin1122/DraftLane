// Drafting labels frame the workspace without competing with its content.
export function MapAnnotations() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-6 hidden justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50 md:flex">
      <span>DraftLane / Working space</span>
      <span>Ideas in motion ↗</span>
    </div>
  );
}
