import { describe, expect, it } from 'vitest';
import { respondToEvent } from './actions';
import { flagship, winProbability } from './model';
import { newGame } from './init';
import { deserialize, saveSummary, serialize } from './save';
import { advanceWeek, isPaused } from './tick';
import type { GameState } from './types';

/** Advance `weeks`, answering every blocking event with its first choice. */
export function autoPlay(state: GameState, weeks: number): void {
  for (let i = 0; i < weeks && !state.gameOver; i++) {
    while (state.pendingEvents.length > 0) respondToEvent(state, state.pendingEvents[0].choices[0].id);
    advanceWeek(state);
  }
}

function assertNoNaN(obj: unknown, path = 'state'): void {
  if (typeof obj === 'number') {
    if (Number.isNaN(obj)) throw new Error(`NaN at ${path}`);
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => assertNoNaN(v, `${path}[${i}]`));
    return;
  }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) assertNoNaN(v, `${path}.${k}`);
  }
}

describe('advanceWeek', () => {
  it('pauses while a blocking event is pending', () => {
    const state = newGame('helios', 1);
    state.pendingEvents.push({ eventId: 'x', labId: 'helios', week: 0, title: 't', body: 'b', choices: [{ id: 'a', label: 'A', detail: '' }], data: {} });
    expect(isPaused(state)).toBe(true);
    const week = state.week;
    advanceWeek(state);
    expect(state.week).toBe(week);
  });

  it('runs 150 weeks without NaN or crashes, all invariants hold', () => {
    const state = newGame('helios', 42);
    state.labs.helios.cash = 50_000; // fund the do-nothing player through 150 weeks
    autoPlay(state, 150);
    assertNoNaN(state);
    expect(state.week).toBeGreaterThan(100);
    for (const lab of Object.values(state.labs)) {
      const m = flagship(lab);
      if (!lab.alive || !m) continue;
      expect(m.alignmentLo).toBeLessThanOrEqual(m.alignment);
      expect(m.alignmentHi).toBeGreaterThanOrEqual(m.alignment);
      expect(m.robustness).toBeGreaterThanOrEqual(0);
      expect(m.robustness).toBeLessThanOrEqual(100);
      const committed =
        lab.contracts.reduce((s, c) => s + c.chips, 0) + lab.enterprise.reduce((s, c) => s + c.chips, 0) + (lab.run?.chips ?? 0) + (lab.postTraining?.chips ?? 0);
      expect(lab.alloc.inference + lab.alloc.alignment).toBe(Math.max(0, lab.chips - committed)); // no idle, no overcommit
      expect(lab.publicTrust).toBeGreaterThanOrEqual(0);
      expect(lab.publicTrust).toBeLessThanOrEqual(100);
      expect(lab.boardYours + lab.boardInvestors).toBe(9);
    }
    expect(state.world.adoption).toBeGreaterThan(12); // adoption grew
    expect(state.history.length).toBeGreaterThan(0);
  });

  it('is deterministic: same seed + same choices = identical state', () => {
    const a = newGame('helios', 123);
    const b = newGame('helios', 123);
    autoPlay(a, 120);
    autoPlay(b, 120);
    expect(serialize(a)).toBe(serialize(b));
  });

  it('different seeds diverge', () => {
    const a = newGame('helios', 1);
    const b = newGame('helios', 2);
    autoPlay(a, 60);
    autoPlay(b, 60);
    expect(serialize(a)).not.toBe(serialize(b));
  });

  it('rival labs make progress on their own', () => {
    const state = newGame('helios', 7);
    const cap0 = flagship(state.labs.axiom)!.capability;
    autoPlay(state, 120);
    if (state.labs.axiom.alive) {
      expect(flagship(state.labs.axiom)!.capability).toBeGreaterThan(cap0 + 3);
    }
  });

  it('a lab crossing capability 100 ends the game one way or another', () => {
    const state = newGame('helios', 5);
    flagship(state.labs.helios)!.capability = 100;
    advanceWeek(state);
    expect(state.gameOver).not.toBeNull();
  });

  it('low alignment at 100 capability always loses; 100 alignment nearly always wins', () => {
    let lowWins = 0;
    let highWins = 0;
    for (let seed = 0; seed < 200; seed++) {
      const low = newGame('helios', seed);
      const m1 = flagship(low.labs.helios)!;
      m1.capability = 100;
      m1.alignment = 50;
      advanceWeek(low);
      if (low.gameOver?.result === 'win') lowWins++;

      const high = newGame('helios', seed + 5000);
      const m2 = flagship(high.labs.helios)!;
      m2.capability = 100;
      m2.alignment = 100;
      advanceWeek(high);
      if (high.gameOver?.result === 'win') highWins++;
    }
    expect(lowWins).toBe(0);
    // p(win)=0.88 at alignment 100 → expect ~176/200; 160 is ~3.5σ below
    expect(highWins).toBeGreaterThan(160);
    expect(winProbability(50)).toBe(0);
  });

  it('a rival crossing 100 also ends the game (their roll decides which way)', () => {
    const state = newGame('helios', 5);
    const m = flagship(state.labs.axiom)!;
    m.capability = 100;
    m.alignment = 0;
    m.robustness = 99; // keep a terminal jailbreak from racing the ASI roll
    advanceWeek(state);
    expect(state.gameOver).not.toBeNull();
    expect(state.gameOver!.result).toBe('loss');
    expect(state.gameOver!.reason).toBe('rival-misaligned-asi');
  });

  it('bankruptcy: grace period then game over', () => {
    const state = newGame('helios', 3);
    const lab = state.labs.helios;
    lab.cash = -100;
    lab.valuation = 0; // emergency raise won't help either
    let weeks = 0;
    while (!state.gameOver && weeks < 30) {
      state.pendingEvents = [];
      advanceWeek(state);
      weeks++;
    }
    expect(state.gameOver?.reason).toBe('bankrupt');
    expect(weeks).toBeGreaterThan(5); // grace period was honored
  });
});

describe('notice-flagged feed items', () => {
  it('flags player outcomes (chip delivery) as notices, but not rival ones', () => {
    const state = newGame('helios', 5);
    state.labs.helios.chipOrders.push({ chips: 5000, orderedWeek: state.week, arrivesWeek: state.week + 1 });
    state.labs.axiom.chipOrders.push({ chips: 5000, orderedWeek: state.week, arrivesWeek: state.week + 1 });
    autoPlay(state, 2);
    const delivered = state.feed.filter((f) => f.title === 'Chips delivered');
    expect(delivered.length).toBe(1); // only the player's delivery is reported
    expect(delivered[0].notice).toBe(true);
  });

  it('flags the revenue-target verdict as a notice', () => {
    const state = newGame('helios', 5);
    state.labs.helios.revenueExpectation = { target: 1, deadlineWeek: state.week + 1 };
    autoPlay(state, 2);
    const verdict = state.feed.find((f) => f.title.startsWith('Revenue target'));
    expect(verdict).toBeDefined();
    expect(verdict!.notice).toBe(true);
  });
});

describe('save/load', () => {
  it('roundtrips exactly and the loaded game continues deterministically', () => {
    const state = newGame('helios', 99);
    autoPlay(state, 50);
    const json = serialize(state);
    const loaded = deserialize(json);
    expect(serialize(loaded)).toBe(json);
    // both continue identically
    autoPlay(state, 30);
    autoPlay(loaded, 30);
    expect(serialize(loaded)).toBe(serialize(state));
  });

  it('rejects garbage', () => {
    expect(() => deserialize('{"version": 99}')).toThrow();
    expect(() => deserialize('{}')).toThrow();
  });

  it('saveSummary describes the player lab', () => {
    const state = newGame('helios', 12);
    autoPlay(state, 20);
    const sum = saveSummary(state);
    expect(sum.labName).toBe(state.labs.helios.name);
    expect(sum.week).toBe(state.week);
    expect(sum.dateLabel.length).toBeGreaterThan(0);
    expect(sum.capability).toBeGreaterThan(0);
    expect(sum.cash).toBe(state.labs.helios.cash);
    expect(sum.gameOver).toBeNull();
  });
});
