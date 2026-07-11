import { describe, expect, it } from 'vitest';
import { nextResearchPicks, nextTreatyPicks, suggestAction, suggestActions } from './advisor';
import { respondToEvent } from './actions';
import { flagship } from './model';
import { researchBlocked } from './research';
import { newGame } from './init';
import { serialize, deserialize } from './save';
import { advanceWeek } from './tick';
import type { GameState } from './types';

function fresh(seed = 1): GameState {
  return newGame('helios', seed, true);
}

describe('advisor', () => {
  it('is pure: does not mutate state or advance the rng', () => {
    const state = fresh();
    const before = serialize(state);
    suggestAction(state);
    suggestAction(state);
    expect(serialize(state)).toBe(before);
  });

  it('returns null when the game is over', () => {
    const state = fresh();
    state.gameOver = { result: 'loss', reason: 'bankrupt', title: 'x', body: 'y', week: 1 };
    expect(suggestAction(state)).toBeNull();
  });

  it('screams about the emergency round when broke', () => {
    const state = fresh();
    state.labs.helios.cash = -50;
    const hint = suggestAction(state)!;
    expect(hint.id).toBe('emergency-raise');
    expect(hint.urgent).toBe(true);
    expect(hint.tab).toBe('finance');
  });

  it('suggests fundraising when the runway gets short', () => {
    const state = fresh();
    const lab = state.labs.helios;
    lab.cash = 300;
    lab.weeklyCosts = 40;
    lab.weeklyRevenue = 10;
    const hint = suggestAction(state)!;
    expect(hint.id).toBe('raise-runway');
  });

  it('suggests promoting when a clearly better model sits in the vault', () => {
    const state = fresh();
    const lab = state.labs.helios;
    lab.cash = 50_000; // rule out money hints
    const better = { ...lab.models[0], id: 'better', name: 'HELIOS-X', capability: lab.models[0].capability + 10 };
    lab.models.push(better);
    const hint = suggestAction(state)!;
    expect(hint.id).toBe('promote-better');
    expect(hint.tab).toBe('models');
  });

  it('urges an alignment pivot near the threshold', () => {
    const state = fresh();
    const lab = state.labs.helios;
    lab.cash = 50_000;
    const m = flagship(lab)!;
    m.capability = 85;
    m.robustness = 99; // rule out the jailbreak hint
    m.alignment = 40;
    m.alignmentLo = 30;
    m.alignmentHi = 70;
    lab.alloc.alignment = 0;
    const hint = suggestAction(state)!;
    expect(hint.id).toBe('align-or-die');
    expect(hint.urgent).toBe(true);
  });

  it('flags high jailbreak risk and points at hardening', () => {
    const state = fresh();
    const lab = state.labs.helios;
    lab.cash = 50_000;
    const m = flagship(lab)!;
    m.capability = 60;
    m.robustness = 10;
    state.world.adoption = 60;
    const hint = suggestAction(state)!;
    expect(hint.id).toBe('robustness');
  });

  it('suggests a training run when idle and funded', () => {
    const state = fresh();
    const lab = state.labs.helios;
    lab.cash = 100_000;
    lab.run = null;
    // a fleet big enough that the run planner sees a worthwhile run
    lab.chips = 300_000;
    lab.alloc = { inference: 290_000, alignment: 10_000 };
    // fill research so the research hint can't outrank... run hint comes first anyway
    const hint = suggestAction(state)!;
    expect(['start-run', 'promote-better']).toContain(hint.id);
    expect(hint.id).toBe('start-run');
    expect(hint.tab).toBe('models');
  });

  it('falls back to research suggestions when a run is already going', () => {
    const state = fresh();
    const lab = state.labs.helios;
    lab.cash = 100_000;
    lab.run = { id: 'r', codename: 'X', modelName: 'HELIOS-2', targetFlop: 1e27, doneFlop: 0, startedWeek: 0, chips: 6000, estCapability: 30, costPaid: 0 };
    const hint = suggestAction(state)!;
    expect(hint.id.startsWith('research-')).toBe(true);
    expect(hint.tab).toBe('research');
  });

  it('eventually says all-clear when everything is humming', () => {
    const state = fresh();
    const lab = state.labs.helios;
    lab.cash = 100_000;
    lab.run = { id: 'r', codename: 'X', modelName: 'HELIOS-2', targetFlop: 1e27, doneFlop: 0, startedWeek: 0, chips: 6000, estCapability: 30, costPaid: 0 };
    lab.research.active = [
      { nodeId: 'constitutional', weeksDone: 0, totalWeeks: 5 },
      { nodeId: 'evals-redteam', weeksDone: 0, totalWeeks: 5 },
    ];
    lab.chips = 80_000;
    lab.alloc = { inference: 76_000, alignment: 4000 }; // enough capacity that buy-chips stays quiet
    state.diplomacy.completed = ['transparency-pledge', 'incident-reporting', 'responsible-scaling']; // T1 treaties otherwise correctly suggested
    const hint = suggestAction(state)!;
    expect(hint.id).toBe('cruise');
    expect(hint.urgent).toBe(false);
  });

  it('always returns some hint for a live game across many real states', () => {
    const state = fresh(7);
    for (let i = 0; i < 60 && !state.gameOver; i++) {
      while (state.pendingEvents.length > 0) respondToEvent(state, state.pendingEvents[0].choices[0].id);
      advanceWeek(state);
      const hint = suggestAction(state);
      if (!state.gameOver) {
        expect(hint).not.toBeNull();
        expect(hint!.title.length).toBeGreaterThan(5);
        expect(hint!.body.length).toBeGreaterThan(10);
      }
    }
  });

  it('returns a full priority-ordered list; suggestAction is its head', () => {
    const state = fresh();
    const lab = state.labs.helios;
    // stack several situations at once
    lab.cash = -50; // emergency
    const better = { ...lab.models[0], id: 'better', name: 'HELIOS-X', capability: lab.models[0].capability + 10 };
    lab.models.push(better); // promote-better
    lab.alloc.alignment = 0; // some-alignment
    const hints = suggestActions(state);
    expect(hints.length).toBeGreaterThanOrEqual(3);
    expect(hints[0].id).toBe('emergency-raise'); // solvency outranks everything
    const ids = hints.map((h) => h.id);
    expect(ids).toContain('promote-better');
    expect(ids).toContain('some-alignment');
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
    expect(suggestAction(state)!.id).toBe(hints[0].id);
  });

  it('the list is pure too and offers alternatives in normal play', () => {
    const state = fresh(3);
    const before = serialize(state);
    const hints = suggestActions(state);
    expect(serialize(state)).toBe(before);
    // a fresh game has more than one sensible thing to do (run, research, treaties…)
    expect(hints.length).toBeGreaterThanOrEqual(2);
    for (const h of hints) {
      expect(h.title.length).toBeGreaterThan(5);
      expect(h.tab.length).toBeGreaterThan(0);
    }
  });

  it('cruise appears only when nothing else does', () => {
    const state = fresh();
    const lab = state.labs.helios;
    lab.cash = 100_000;
    lab.run = { id: 'r', codename: 'X', modelName: 'HELIOS-2', targetFlop: 1e27, doneFlop: 0, startedWeek: 0, chips: 6000, estCapability: 30, costPaid: 0 };
    lab.research.active = [
      { nodeId: 'constitutional', weeksDone: 0, totalWeeks: 5 },
      { nodeId: 'evals-redteam', weeksDone: 0, totalWeeks: 5 },
    ];
    lab.chips = 80_000;
    lab.alloc = { inference: 76_000, alignment: 4000 }; // enough capacity that buy-chips stays quiet
    state.diplomacy.completed = ['transparency-pledge', 'incident-reporting', 'responsible-scaling'];
    const hints = suggestActions(state);
    expect(hints.map((h) => h.id)).toEqual(['cruise']);
    // and never alongside real hints
    lab.cash = -5;
    expect(suggestActions(state).map((h) => h.id)).not.toContain('cruise');
  });

  it('hintsEnabled is off by default, on when requested, and survives save/load', () => {
    expect(newGame('helios', 1).hintsEnabled).toBe(false);
    const state = newGame('helios', 1, true);
    expect(state.hintsEnabled).toBe(true);
    expect(deserialize(serialize(state)).hintsEnabled).toBe(true);
  });

  it('nextResearchPicks is pure and returns unlocked (or merely cash-short) nodes', () => {
    const state = fresh();
    const before = serialize(state);
    const picks = nextResearchPicks(state, 3);
    expect(serialize(state)).toBe(before);
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.length).toBeLessThanOrEqual(3);
    const lab = state.labs.helios;
    const cap = flagship(lab)!.capability;
    for (const id of picks) {
      const blocked = researchBlocked(lab, id, cap);
      expect(blocked === null || blocked === 'not enough cash').toBe(true);
    }
    // never suggests completed or active nodes
    state.labs.helios.research.completed.push(picks[0]);
    expect(nextResearchPicks(state, 3)).not.toContain(picks[0]);
  });

  it('nextTreatyPicks walks the frontier of the treaty tree', () => {
    const state = fresh();
    // fresh game: only tier-1 treaties have their prereqs (none) met
    expect(nextTreatyPicks(state, 3)).toEqual(['transparency-pledge', 'incident-reporting', 'responsible-scaling']);
    state.diplomacy.completed = ['transparency-pledge', 'incident-reporting'];
    const picks = nextTreatyPicks(state, 3);
    expect(picks).toContain('responsible-scaling');
    expect(picks).toContain('joint-safety-institute'); // unlocked by transparency-pledge
    expect(picks).not.toContain('transparency-pledge'); // already in force
  });
});
