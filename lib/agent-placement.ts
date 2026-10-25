export type Bounds = { x: number; y: number; w: number; h: number };
export const DRAWING_GAP = 320;
export function reservedDrawingEdge(bounds: Bounds[]): number | null {
  return bounds.length ? Math.max(...bounds.map((b) => b.x + b.w)) + DRAWING_GAP : null;
}
export function drawingShift(edge: number | null, bounds: Bounds[]): number {
  return edge === null || !bounds.length ? 0 : Math.max(0, edge - Math.min(...bounds.map((b) => b.x)));
}
