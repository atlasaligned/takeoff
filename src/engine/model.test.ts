import { describe, expect, it } from 'vitest';
import { BAL } from './balance';
import {
  abortCapabilityFraction,
  alignmentGainPreview,
  alignmentWorkTick,
  applyBandWidth,
  applyPostTraining,
  bandWidth,
  capabilityFromFlop,
  finishTrainingRun,
  rebalanceAllocations,
  flagship,
  flopForCapability,
  rsiTick,
  shiftAlignment,
  winProbability,
} from './model';
import { newGame } from './init';
import { makeRng } from './rng';
import type { Lab, Model, TrainingRun } from './types';

function testLab(): Lab {
  const state = newGame('helios', 1);
  return state.labs.helios;
}

describe('capability curve', () => {
  it('is monotonically increasing in FLOP (above the curve floor)', () => {
    let prev = -1;
    for (let e = 27; e <= 34; e++) {
      const cap = capabilityFromFlop(Math.pow(10, e));
      expect(cap).toBeGreaterThan(prev);
      prev = cap;
    }
  });

  it('gains a fixed amount per decade of compute (log-like)', () => {
    const c29 = capabilityFromFlop(1e29);
    const c30 = capabilityFromFlop(1e30);
    expect(c30 - c29).toBeCloseTo(BAL.CAP_PER_DECADE, 5);
  });

  it('flopForCapability inverts capabilityFromFlop', () => {
    for (const cap of [20, 40, 60, 80, 100]) {
      expect(capabilityFromFlop(flopForCapability(cap))).toBeCloseTo(cap, 6);
    }
  });

  it('requires ~10x the compute for each +CAP_PER_DECADE step', () => {
    expect(flopForCapability(40 + BAL.CAP_PER_DECADE) / flopForCapability(40)).toBeCloseTo(10, 5);
  });
});

describe('abort penalty', () => {
  it('keeps almost nothing early and almost everything late', () => {
    expect(abortCapabilityFraction(0.2)).toBeLessThan(0.02);
    expect(abortCapabilityFraction(0.5)).toBeLessThan(0.2);
    expect(abortCapabilityFraction(0.95)).toBeGreaterThan(0.8);
    expect(abortCapabilityFraction(1)).toBe(1);
  });

  it('is monotonic', () => {
    for (let p = 0.1; p < 1; p += 0.1) {
      expect(abortCapabilityFraction(p + 0.05)).toBeGreaterThan(abortCapabilityFraction(p));
    }
  });
});

describe('alignment band', () => {
  function model(align: number, skew = 0.5): Model {
    return {
      id: 'm',
      name: 'M',
      createdWeek: 0,
      capability: 30,
      alignment: align,
      alignmentLo: 0,
      alignmentHi: 100,
      bandSkew: skew,
      robustness: 50,
      postTrainCount: 0,
    };
  }

  it('always contains the true value', () => {
    for (const align of [2, 15, 50, 85, 99]) {
      for (const skew of [0.15, 0.5, 0.85]) {
        for (const width of [55, 30, 10, 3]) {
          const m = model(align, skew);
          applyBandWidth(m, width);
          expect(m.alignmentLo).toBeLessThanOrEqual(m.alignment);
          expect(m.alignmentHi).toBeGreaterThanOrEqual(m.alignment);
          expect(m.alignmentLo).toBeGreaterThanOrEqual(0);
          expect(m.alignmentHi).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('is NOT centered on the true value (skew ≠ 0.5)', () => {
    const m = model(50, 0.2);
    applyBandWidth(m, 40);
    const mid = (m.alignmentLo + m.alignmentHi) / 2;
    expect(Math.abs(mid - m.alignment)).toBeGreaterThan(5);
  });

  it('shiftAlignment keeps the band around the moved value', () => {
    const m = model(40);
    applyBandWidth(m, 30);
    shiftAlignment(m, 25);
    expect(m.alignment).toBe(65);
    expect(m.alignmentLo).toBeLessThanOrEqual(65);
    expect(m.alignmentHi).toBeGreaterThanOrEqual(65);
    expect(bandWidth(m)).toBeCloseTo(30, 5);
  });

  it('respects the minimum width unless zeroed by provable alignment path', () => {
    const m = model(50);
    applyBandWidth(m, 1);
    expect(bandWidth(m)).toBeCloseTo(BAL.BAND_MIN_WIDTH, 5);
  });
});

describe('win probability', () => {
  it('is zero at or below 80 alignment', () => {
    expect(winProbability(0)).toBe(0);
    expect(winProbability(80)).toBe(0);
    expect(winProbability(79.9)).toBe(0);
  });

  it('matches the control points', () => {
    for (const [a, p] of BAL.WIN_ROLL_POINTS) {
      expect(winProbability(a)).toBeCloseTo(p, 6);
    }
  });

  it('is small below 90 and strong at 100', () => {
    expect(winProbability(89)).toBeLessThan(0.12);
    expect(winProbability(100)).toBeGreaterThanOrEqual(0.85);
  });

  it('is monotonic', () => {
    for (let a = 80; a < 100; a += 0.5) {
      expect(winProbability(a + 0.5)).toBeGreaterThanOrEqual(winProbability(a));
    }
  });
});

describe('training run finish', () => {
  function run(targetFlop: number, doneFlop: number): TrainingRun {
    return { id: 'r', codename: 'TEST', modelName: 'HELIOS-2', targetFlop, doneFlop, startedWeek: 0, chips: 5000, estCapability: 0, costPaid: 0 };
  }

  it('completed runs produce the full log-curve capability (absent people bonuses)', () => {
    const lab = testLab();
    lab.csuite = {};
    lab.stars = [];
    const m = finishTrainingRun(lab, run(1e29, 1e29), 10, 1, makeRng(1), false);
    expect(m.capability).toBeCloseTo(capabilityFromFlop(1e29), 1);
  });

  it('aborting early forfeits nearly all capability', () => {
    const lab = testLab();
    const full = finishTrainingRun(lab, run(1e29, 1e29), 10, 1, makeRng(1), false);
    const lab2 = testLab();
    const aborted = finishTrainingRun(lab2, run(1e29, 0.4e29), 10, 1, makeRng(1), true);
    expect(aborted.capability).toBeLessThan(full.capability * 0.1);
  });

  it('new model band contains true alignment', () => {
    for (let seed = 0; seed < 50; seed++) {
      const lab = testLab();
      const m = finishTrainingRun(lab, run(1e29, 1e29), 10, 1, makeRng(seed), false);
      expect(m.alignmentLo).toBeLessThanOrEqual(m.alignment);
      expect(m.alignmentHi).toBeGreaterThanOrEqual(m.alignment);
    }
  });

  it('research multipliers raise the capability of the same FLOP', () => {
    const lab = testLab();
    const base = finishTrainingRun(lab, run(1e29, 1e29), 10, 1, makeRng(1), false);
    const lab2 = testLab();
    lab2.research.completed.push('chinchilla');
    const boosted = finishTrainingRun(lab2, run(1e29, 1e29), 10, 1, makeRng(1), false);
    expect(boosted.capability).toBeGreaterThan(base.capability + 3);
  });
});

describe('post-training', () => {
  it('has diminishing returns', () => {
    const lab = testLab();
    const m = flagship(lab)!;
    const cap0 = m.capability;
    applyPostTraining(lab);
    const gain1 = m.capability - cap0;
    applyPostTraining(lab);
    const gain2 = m.capability - cap0 - gain1;
    expect(gain2).toBeLessThan(gain1);
    expect(gain2).toBeCloseTo(gain1 * BAL.POST_TRAIN_DECAY, 5);
  });
});

describe('alignment work', () => {
  it('raises alignment and narrows the band', () => {
    const lab = testLab();
    const m = flagship(lab)!;
    lab.alloc.alignment = 5000;
    const a0 = m.alignment;
    const w0 = bandWidth(m);
    alignmentWorkTick(lab);
    expect(m.alignment).toBeGreaterThan(a0);
    expect(bandWidth(m)).toBeLessThan(w0);
  });

  it('cannot push past the research-determined ceiling', () => {
    const lab = testLab();
    const m = flagship(lab)!;
    lab.alloc.alignment = 50_000;
    lab.chips = 60_000;
    for (let i = 0; i < 2000; i++) alignmentWorkTick(lab);
    expect(m.alignment).toBeLessThanOrEqual(BAL.ALIGN_CEILING_BASE + 0.01);
  });

  it('glass box raises the ceiling', () => {
    const lab = testLab();
    lab.research.completed.push('glass-box');
    const m = flagship(lab)!;
    lab.alloc.alignment = 50_000;
    lab.chips = 60_000;
    for (let i = 0; i < 3000; i++) alignmentWorkTick(lab);
    expect(m.alignment).toBeGreaterThan(BAL.ALIGN_CEILING_BASE + 5);
    expect(m.alignment).toBeLessThanOrEqual(BAL.ALIGN_CEILING_GLASS_BOX + 0.01);
  });

  it('does nothing with zero alignment chips', () => {
    const lab = testLab();
    const m = flagship(lab)!;
    lab.alloc.alignment = 0;
    const a0 = m.alignment;
    alignmentWorkTick(lab);
    expect(m.alignment).toBe(a0);
  });

  it('preview matches the gain the tick applies, without mutating', () => {
    const lab = testLab();
    const m = flagship(lab)!;
    lab.alloc.alignment = 5000;
    const a0 = m.alignment;
    const w0 = bandWidth(m);
    const preview = alignmentGainPreview(lab);
    expect(m.alignment).toBe(a0);
    expect(bandWidth(m)).toBe(w0);
    expect(alignmentWorkTick(lab)).toBeCloseTo(preview, 10);
    expect(m.alignment).toBeCloseTo(a0 + preview, 10);
  });
});

describe('RSI', () => {
  it('does nothing before takeoff', () => {
    const lab = testLab();
    const m = flagship(lab)!;
    const c0 = m.capability;
    rsiTick(lab);
    expect(m.capability).toBe(c0);
  });

  it('grows capability proportionally after takeoff, tapering toward the ceiling', () => {
    const lab = testLab();
    lab.rsiRate = BAL.RSI_BASE_RATE;
    const m = flagship(lab)!;
    const c0 = m.capability;
    rsiTick(lab);
    // self-growth is scaled by the deceleration factor (1 - cap/RSI_DECEL_CAP)
    const decel = 1 - c0 / BAL.RSI_DECEL_CAP;
    expect(m.capability).toBeCloseTo(c0 * (1 + BAL.RSI_BASE_RATE * decel), 6);
  });

  it('intelligence explosion compounds the rate', () => {
    const lab = testLab();
    lab.rsiRate = BAL.RSI_BASE_RATE;
    lab.research.completed.push('intelligence-explosion');
    rsiTick(lab);
    expect(lab.rsiRate).toBeCloseTo(BAL.RSI_BASE_RATE * BAL.RSI_ACCEL, 8);
  });

  it('IE pacing: from cap 75 RSI takes a long, tapering grind to 100 — never instant', () => {
    const lab = testLab();
    lab.rsiRate = BAL.RSI_BASE_RATE;
    lab.research.completed.push('intelligence-explosion');
    const m = flagship(lab)!;
    m.capability = 75;
    let weeks = 0;
    while (m.capability < 100 && weeks < 300) {
      rsiTick(lab);
      weeks++;
    }
    expect(weeks).toBeGreaterThan(8); // not an instant loss
    // deliberately slow: RSI can no longer autopilot to 100 in a season — the
    // taper near the ceiling means the final stretch needs real training runs
    expect(weeks).toBeLessThan(160);
  });
});

describe('rebalanceAllocations', () => {
  it('clamps alignment to what commitments leave over; inference absorbs the rest', () => {
    const lab = testLab();
    lab.chips = 10_000;
    lab.contracts.push({ id: 'c', name: 'gov', weeklyPay: 5, chips: 4000, startedWeek: 0 });
    lab.alloc = { inference: 0, alignment: 9000 };
    rebalanceAllocations(lab);
    expect(lab.alloc.alignment).toBe(6000);
    expect(lab.alloc.inference).toBe(0);
    lab.alloc.alignment = 1000;
    rebalanceAllocations(lab);
    expect(lab.alloc.inference).toBe(5000); // no idle — remainder is inference
  });
});
