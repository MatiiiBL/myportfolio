import type { Point } from "../../lib/hnsw/hnsw";

// Geometry of the three-layer drawing: each layer is a flat parallelogram seen from above at an
// angle, stacked top layer first, so a point keeps its screen x on every layer and the descent
// between layers is a vertical drop. Used by the home page and by the share-image script.

export interface Plane {
  left: number;
  top: number;
  width: number;
  /** Screen height of the plane (its depth, foreshortened). */
  depth: number;
  /** How far right the back edge sits from the front edge. */
  skew: number;
}

export interface LayersLayout {
  width: number;
  height: number;
  /** planes[layer], layer 0 at the bottom. */
  planes: Plane[];
}

/** The drawing's coordinate system: a fixed viewBox that scales with its container. */
export function layersLayout(layerCount = 3): LayersLayout {
  const width = 480;
  const depth = 92;
  const gap = 124;
  const top = 14;
  const planes = Array.from({ length: layerCount }, (_, layer) => ({
    left: 8,
    top: top + (layerCount - 1 - layer) * gap,
    width: 352,
    depth,
    skew: 84,
  }));
  return { width, height: top + (layerCount - 1) * gap + depth + 14, planes };
}

/** Screen position of a point (unit-square coordinates) on a plane; y = 0 is the back edge. */
export function project(p: Point, plane: Plane): { x: number; y: number } {
  return {
    x: plane.left + p.x * plane.width + (1 - p.y) * plane.skew,
    y: plane.top + p.y * plane.depth,
  };
}

/** The point on a plane under a screen position, clamped to the plane. */
export function unproject(x: number, y: number, plane: Plane): Point {
  const py = clamp((y - plane.top) / plane.depth);
  const px = clamp((x - plane.left - (1 - py) * plane.skew) / plane.width);
  return { x: px, y: py };
}

/** The plane whose band (with half the gap above and below) contains a screen y. */
export function planeAt(y: number, layout: LayersLayout): number {
  let best = 0;
  let bestDistance = Infinity;
  layout.planes.forEach((plane, layer) => {
    const d = Math.abs(y - (plane.top + plane.depth / 2));
    if (d < bestDistance) {
      bestDistance = d;
      best = layer;
    }
  });
  return best;
}

/** The outline of a plane as an SVG path. */
export function planeOutline(plane: Plane): string {
  const { left, top, width, depth, skew } = plane;
  return `M${left + skew},${top}H${left + skew + width}L${left + width},${top + depth}H${left}Z`;
}

function clamp(v: number): number {
  return Math.min(1, Math.max(0, v));
}
