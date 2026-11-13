// The order in which a scheduled matmul visits its register tiles, which is what the access
// view animates. It follows from the loop nest of `scheduleMatmul` (a unit test checks it against
// the interpreted IR): one step is one iteration of the loop just above the reduction loop k.

import type { MatmulConfig, MatmulShape } from "./matmul";
import { PACK_LIMIT } from "./matmul";

export interface TileStep {
  /** Row tile (rows row * tile_m ... + tile_m) and column tile of C. */
  row: number;
  col: number;
  /** The strip of W this step uses is copied into W_local first. */
  packs: boolean;
  /** The iteration of the outermost loop (the parallel one, when the loop is parallel). */
  outer: number;
}

export function tileSteps(shape: MatmulShape, cfg: MatmulConfig): TileStep[] {
  const rows = shape.m / cfg.tile_m;
  const cols = shape.n / cfg.tile_n;
  const packed = cfg.order === "nm" && cfg.pack_b && shape.k * cfg.tile_n * 4 <= PACK_LIMIT;
  const steps: TileStep[] = [];
  if (cfg.order === "nm") {
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        steps.push({ row, col, packs: packed && row === 0, outer: col });
      }
    }
  } else {
    for (let f = 0; f < rows * cols; f++) {
      steps.push({ row: Math.floor(f / cols), col: f % cols, packs: false, outer: f });
    }
  }
  return steps;
}

/** Facts about one register tile that follow from the loop nest alone (no measurement). */
export interface TileFacts {
  accumulators: number;
  /** Multiply-adds per element of A and W loaded inside the reduction loop. */
  macsPerLoad: number;
  /** Bytes of the packed strip of W, when there is one. */
  stripBytes: number;
  /** Steps between two uses of the same strip of W: 1 when consecutive. */
  stripReuseDistance: number;
}

export function tileFacts(shape: MatmulShape, cfg: MatmulConfig): TileFacts {
  const cols = shape.n / cfg.tile_n;
  return {
    accumulators: cfg.tile_m * cfg.tile_n,
    macsPerLoad: (cfg.tile_m * cfg.tile_n) / (cfg.tile_m + cfg.tile_n),
    stripBytes: shape.k * cfg.tile_n * 4,
    stripReuseDistance: cfg.order === "nm" ? 1 : cols,
  };
}
