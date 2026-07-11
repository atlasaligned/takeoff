import { describe, expect, it } from 'vitest';
import { newGame } from './init';
import { flagship } from './model';
import { labMods, RESEARCH, RESEARCH_BY_ID, researchBlocked } from './research';
import { startResearch } from './actions';
import { advanceWeek } from './tick';

describe('research tree data', () => {
  it('every prereq exists', () => {
    for (const node of RESEARCH) {
      for (const p of node.prereqs) {
        expect(RESEARCH_BY_ID[p], `${node.id} requires unknown ${p}`).toBeDefined();
      }
    }
  });

  it('prereqs never sit in a higher tier than the node', () => {
    // same-tier chains within a branch are allowed (e.g. Deterrence Collapse needs
    // Boost-Phase Missile Defense); cross-branch prereqs are exempt entirely
    for (const node of RESEARCH) {
      for (const p of node.prereqs) {
        expect(RESEARCH_BY_ID[p].tier).toBeLessThanOrEqual(node.tier);
      }
    }
  });

  it('ids are unique', () => {
    expect(new Set(RESEARCH.map((n) => n.id)).size).toBe(RESEARCH.length);
  });
});

describe('research gating', () => {
  it('blocks on capability, prereqs, cash and duplicates', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    expect(researchBlocked(lab, 'neuralese', 20)).toMatch(/needs/);
    expect(researchBlocked(lab, 'rsi', 90)).toMatch(/Automated AI Researcher/);
    lab.cash = 1;
    expect(researchBlocked(lab, 'constitutional', 20)).toBe('not enough cash');
    lab.cash = 10_000;
    expect(researchBlocked(lab, 'constitutional', 20)).toBeNull();
    lab.research.completed.push('constitutional');
    expect(researchBlocked(lab, 'constitutional', 20)).toBe('already researched');
  });

  it('startResearch pays and queues; completion applies effects', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    lab.cash = 10_000;
    flagship(lab)!.capability = 40; // clear On-Chip Attestation's capability gate
    lab.research.completed.push('custom-silicon'); // its prereq
    const cashBefore = lab.cash;
    const res = startResearch(state, lab, 'on-chip-attestation');
    expect(res.ok).toBe(true);
    expect(lab.cash).toBeLessThan(cashBefore);
    expect(lab.research.active).toHaveLength(1);

    const trustBefore = lab.govTrust;
    // run enough weeks for completion (auto-dismiss any events)
    for (let i = 0; i < 12; i++) {
      state.pendingEvents = [];
      advanceWeek(state);
    }
    expect(lab.research.completed).toContain('on-chip-attestation');
    // trust drifts too, but the +10 bump should dominate
    expect(lab.govTrust).toBeGreaterThan(trustBefore + 4);
  });
});

describe('labMods', () => {
  it('research multipliers stack', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    expect(labMods(lab).effFlopMult).toBe(1);
    lab.research.completed.push('chinchilla');
    expect(labMods(lab).effFlopMult).toBeCloseTo(1.8);
    lab.research.completed.push('neuralese');
    expect(labMods(lab).effFlopMult).toBeCloseTo(3.6);
  });

  it('mixture-of-experts lowers inference cost', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    lab.research.completed.push('moe');
    expect(labMods(lab).inferenceSeatsMult).toBeCloseTo(1.7);
  });

  it('recursive self-improvement enables RSI via tick completion', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    lab.research.active.push({ nodeId: 'rsi', weeksDone: 0, totalWeeks: 1 });
    state.pendingEvents = [];
    advanceWeek(state);
    expect(lab.rsiRate).toBeGreaterThan(0);
  });

  it('star researchers contribute bonuses', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    lab.stars = [{ id: 's', name: 'X', field: 'agents', bonus: 10, salary: 0.2, tier: 2 }];
    expect(labMods(lab).revenueMult).toBeCloseTo(1.1);
  });
});
