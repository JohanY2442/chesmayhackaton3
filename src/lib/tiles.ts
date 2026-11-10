import { api } from "./api";

export interface Cell {
  r: number;
  c: number;
  digit: number;
  tremor: number;
  bin: string; // "." sin refinar, o W, F, D, M
}

export interface Tile {
  originRow: number;
  originCol: number;
  rows: number;
  cols: number;
  values: string;
  tremor: Uint8Array;
  bins: string[];
}

interface TileResponse {
  tileRow: number;
  tileCol: number;
  originRow: number;
  originCol: number;
  rows: number;
  cols: number;
  values: string;
  tremor: string;
  bins: string;
  version: number;
}

interface InflightEntry {
  promise: Promise<Tile>;
  controller: AbortController;
  viewport: boolean;
}

function decodeTremor(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Caché de bloques de un archivo: una sola request por bloque en vuelo, cancelable si sale de la vista. */
export class TileStore {
  readonly tiles = new Map<string, Tile>();
  private readonly inflight = new Map<string, InflightEntry>();
  private readonly listeners = new Set<() => void>();

  constructor(
    readonly fileId: string,
    readonly tileSize: number,
    readonly rows: number,
    readonly cols: number,
  ) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }

  key(tileRow: number, tileCol: number): string {
    return `${tileRow},${tileCol}`;
  }

  coords(r: number, c: number): [number, number] {
    return [Math.floor(r / this.tileSize), Math.floor(c / this.tileSize)];
  }

  load(tileRow: number, tileCol: number, options: { viewport?: boolean } = {}): Promise<Tile> {
    const k = this.key(tileRow, tileCol);
    const cached = this.tiles.get(k);
    if (cached) return Promise.resolve(cached);
    const pending = this.inflight.get(k);
    if (pending) return pending.promise;

    const controller = new AbortController();
    const promise = api<TileResponse>(
      `/files/${this.fileId}/tiles/${tileRow}/${tileCol}`,
      {},
      { signal: controller.signal },
    )
      .then((data) => {
        const tile: Tile = {
          originRow: data.originRow,
          originCol: data.originCol,
          rows: data.rows,
          cols: data.cols,
          values: data.values,
          tremor: decodeTremor(data.tremor),
          bins: Array.from(data.bins),
        };
        this.tiles.set(k, tile);
        return tile;
      })
      .finally(() => {
        this.inflight.delete(k);
        this.emit();
      });

    this.inflight.set(k, { promise, controller, viewport: Boolean(options.viewport) });
    return promise;
  }

  /** Cancela las cargas de la vista que ya no están visibles. */
  pruneViewport(keep: Set<string>): void {
    for (const [k, entry] of this.inflight) {
      if (entry.viewport && !keep.has(k)) entry.controller.abort();
    }
  }

  abortAll(): void {
    for (const entry of this.inflight.values()) entry.controller.abort();
  }

  invalidate(keys: string[]): void {
    keys.forEach((k) => this.tiles.delete(k));
    this.emit();
  }

  private read(tile: Tile, r: number, c: number): Cell {
    const idx = (r - tile.originRow) * tile.cols + (c - tile.originCol);
    if (idx < 0 || idx >= tile.values.length) throw new Error("Bloque inconsistente con la posición pedida");
    return {
      r,
      c,
      digit: tile.values.charCodeAt(idx) - 48,
      tremor: tile.tremor[idx] ?? 0,
      bin: tile.bins[idx] ?? ".",
    };
  }

  /** Lectura síncrona: null si el bloque aún no llegó. */
  cellAt(r: number, c: number): Cell | null {
    const [tr, tc] = this.coords(r, c);
    const tile = this.tiles.get(this.key(tr, tc));
    return tile ? this.read(tile, r, c) : null;
  }

  /** Lectura asíncrona: pide el bloque si hace falta. */
  async cell(r: number, c: number): Promise<Cell> {
    const [tr, tc] = this.coords(r, c);
    let tile = this.tiles.get(this.key(tr, tc));
    for (let attempt = 0; !tile; attempt++) {
      try {
        tile = await this.load(tr, tc);
      } catch (error) {
        if (attempt >= 2) throw error;
      }
    }
    return this.read(tile, r, c);
  }

  markBins(cells: { r: number; c: number }[], letter: string): void {
    for (const { r, c } of cells) {
      const [tr, tc] = this.coords(r, c);
      const tile = this.tiles.get(this.key(tr, tc));
      if (!tile) continue;
      tile.bins[(r - tile.originRow) * tile.cols + (c - tile.originCol)] = letter;
    }
    this.emit();
  }
}
