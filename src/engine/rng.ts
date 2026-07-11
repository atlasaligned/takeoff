/**
 * Deterministic RNG. The state is a single uint32 stored inside GameState so
 * that save/load and replays are exact. mulberry32.
 */
export interface RngState {
  s: number;
}

export function makeRng(seed: number): RngState {
  return { s: seed >>> 0 };
}

/** Uniform float in [0, 1). Mutates rng state. */
export function rand(rng: RngState): number {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0;
  let t = rng.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Uniform float in [lo, hi). */
export function randRange(rng: RngState, lo: number, hi: number): number {
  return lo + rand(rng) * (hi - lo);
}

/** Integer in [0, n). */
export function randInt(rng: RngState, n: number): number {
  return Math.floor(rand(rng) * n);
}

/** Approximately normal via sum of 3 uniforms (bounded, cheap, good enough). */
export function randNormal(rng: RngState, mean: number, sd: number): number {
  const u = rand(rng) + rand(rng) + rand(rng); // mean 1.5, sd ~0.5
  return mean + (u - 1.5) * 2 * sd;
}

/** Bernoulli. */
export function chance(rng: RngState, p: number): boolean {
  return rand(rng) < p;
}

export function pick<T>(rng: RngState, arr: readonly T[]): T {
  return arr[randInt(rng, arr.length)];
}

/** Weighted pick; weights must be >= 0 and not all zero. */
export function pickWeighted<T>(rng: RngState, items: readonly T[], weights: readonly number[]): T {
  let total = 0;
  for (const w of weights) total += w;
  let r = rand(rng) * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
