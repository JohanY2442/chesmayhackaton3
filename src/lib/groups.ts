import type { Cell, TileStore } from "./tiles";

export interface Rules {
  tremorThreshold: number;
  connectivity: 4 | 8;
  minGroupSize: number;
  maxGroupSize: number;
  binning: { strategy: "DIGIT_SUM_MOD" | "MAX_DIGIT_MOD"; order: string[] };
}

export interface GroupResult {
  cells: Cell[];
  problem: "not_fear" | "too_small" | "too_big" | "already_refined" | null;
  bin: string | null;
}

const NEIGHBORS_4: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const NEIGHBORS_8: [number, number][] = [
  ...NEIGHBORS_4,
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/** Caja según las reglas del archivo: índice = (suma o máximo de dígitos) % 4. */
export function binFor(digits: number[], rules: Rules): string {
  const value =
    rules.binning.strategy === "MAX_DIGIT_MOD"
      ? Math.max(...digits)
      : digits.reduce((total, digit) => total + digit, 0);
  return rules.binning.order[value % 4];
}

/** Grupo máximo de celdas conectadas que dan miedo, a partir de una celda. */
export async function findGroup(
  store: TileStore,
  start: { r: number; c: number },
  rules: Rules,
): Promise<GroupResult> {
  const first = await store.cell(start.r, start.c);
  if (first.tremor < rules.tremorThreshold) {
    return { cells: [first], problem: "not_fear", bin: null };
  }

  const offsets = rules.connectivity === 8 ? NEIGHBORS_8 : NEIGHBORS_4;
  const seen = new Set<string>([`${first.r},${first.c}`]);
  const queue: Cell[] = [first];
  const cells: Cell[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    cells.push(current);
    if (cells.length > rules.maxGroupSize) {
      return { cells, problem: "too_big", bin: null };
    }
    for (const [dr, dc] of offsets) {
      const nr = current.r + dr;
      const nc = current.c + dc;
      if (nr < 0 || nc < 0 || nr >= store.rows || nc >= store.cols) continue;
      const k = `${nr},${nc}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const neighbor = await store.cell(nr, nc);
      if (neighbor.tremor >= rules.tremorThreshold) queue.push(neighbor);
    }
  }

  if (cells.length < rules.minGroupSize) {
    return { cells, problem: "too_small", bin: null };
  }
  if (cells.some((cell) => cell.bin !== ".")) {
    return { cells, problem: "already_refined", bin: null };
  }
  return { cells, problem: null, bin: binFor(cells.map((cell) => cell.digit), rules) };
}
