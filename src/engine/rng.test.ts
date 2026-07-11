import { describe, expect, it } from 'vitest';
import { chance, makeRng, pick, pickWeighted, rand, randInt, randNormal, randRange } from './rng';

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    for (let i = 0; i < 100; i++) expect(rand(a)).toBe(rand(b));
  });

  it('differs across seeds', () => {
    const a = makeRng(1);
    const b = makeRng(2);
    const va = Array.from({ length: 10 }, () => rand(a));
    const vb = Array.from({ length: 10 }, () => rand(b));
    expect(va).not.toEqual(vb);
  });

  it('rand stays in [0,1)', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 10_000; i++) {
      const x = rand(rng);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('randRange and randInt respect bounds', () => {
    const rng = makeRng(3);
    for (let i = 0; i < 1000; i++) {
      const x = randRange(rng, 5, 9);
      expect(x).toBeGreaterThanOrEqual(5);
      expect(x).toBeLessThan(9);
      const n = randInt(rng, 4);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(4);
    }
  });

  it('randNormal has roughly the right mean', () => {
    const rng = makeRng(11);
    let sum = 0;
    const N = 20_000;
    for (let i = 0; i < N; i++) sum += randNormal(rng, 10, 3);
    expect(sum / N).toBeCloseTo(10, 0);
  });

  it('chance(1) is always true, chance(0) always false', () => {
    const rng = makeRng(5);
    for (let i = 0; i < 100; i++) {
      expect(chance(rng, 1)).toBe(true);
      expect(chance(rng, 0)).toBe(false);
    }
  });

  it('pickWeighted never picks zero-weight items', () => {
    const rng = makeRng(9);
    for (let i = 0; i < 1000; i++) {
      expect(pickWeighted(rng, ['a', 'b', 'c'], [0, 1, 0])).toBe('b');
    }
  });

  it('pick returns elements of the array', () => {
    const rng = makeRng(13);
    const arr = [1, 2, 3];
    for (let i = 0; i < 100; i++) expect(arr).toContain(pick(rng, arr));
  });
});
