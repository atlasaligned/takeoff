import { describe, expect, it } from 'vitest';
import { signTreaty, smallDiplomacy } from './actions';
import { agreementProbability, TREATIES, TREATY_BY_ID, treatyBlocked } from './diplomacy';
import { flagship } from './model';
import { newGame } from './init';
import { advanceWeek } from './tick';

describe('treaty tree', () => {
  it('prereq ids all exist', () => {
    for (const t of TREATIES) {
      for (const p of t.prereqs) expect(TREATY_BY_ID[p]).toBeDefined();
    }
  });

  it('gates on prereqs, risk fear and cash', () => {
    const state = newGame('helios', 1);
    expect(treatyBlocked(state, 'global-pause')).toMatch(/needs/);
    expect(treatyBlocked(state, 'joint-safety-institute')).toMatch(/needs/);
    state.labs.helios.cash = 1;
    expect(treatyBlocked(state, 'transparency-pledge')).toBe('not enough cash');
    state.labs.helios.cash = 5000;
    expect(treatyBlocked(state, 'transparency-pledge')).toBeNull();
  });

  it('T1 treaties sign unconditionally and bump trust', () => {
    const state = newGame('helios', 1);
    const trust = state.labs.helios.publicTrust;
    const res = signTreaty(state, 'transparency-pledge');
    expect(res.ok).toBe(true);
    expect(state.diplomacy.completed).toContain('transparency-pledge');
    expect(state.labs.helios.publicTrust).toBeGreaterThan(trust);
  });

  it('agreement odds fall when the gatekeeper is far ahead', () => {
    const state = newGame('helios', 1);
    const before = agreementProbability(state);
    // make the 2nd strongest rival way stronger than the player
    flagship(state.labs.axiom)!.capability = 90;
    flagship(state.labs.tianshu)!.capability = 80;
    const after = agreementProbability(state);
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThanOrEqual(0.02); // floor — leader near ASI barely negotiates
  });

  it('compute cap treaty destroys excess chips for everyone', () => {
    const state = newGame('helios', 1);
    state.diplomacy.completed = ['transparency-pledge', 'incident-reporting', 'responsible-scaling', 'joint-safety-institute', 'crisis-hotline', 'frontier-registry', 'hardware-verified-compute', 'mutual-inspection'];
    state.labs.helios.research.completed.push('hardware-governance');
    state.govs.us.riskFear = 85;
    state.labs.helios.cash = 50_000;
    state.labs.axiom.chips = 90_000;
    // force agreement by weakening rivals
    for (const id of ['axiom', 'tianshu', 'qingfeng'] as const) flagship(state.labs[id])!.capability = 5;
    const res = signTreaty(state, 'compute-cap-treaty');
    expect(res.ok).toBe(true);
    if (state.diplomacy.completed.includes('compute-cap-treaty')) {
      expect(state.world.chipCap).not.toBeNull();
      expect(state.labs.axiom.chips).toBeLessThanOrEqual(state.world.chipCap!);
    }
  });

  it('global pause is a victory', () => {
    const state = newGame('helios', 1);
    state.diplomacy.completed = ['transparency-pledge', 'incident-reporting', 'responsible-scaling', 'joint-safety-institute', 'crisis-hotline', 'frontier-registry', 'hardware-verified-compute', 'mutual-inspection', 'compute-cap-treaty', 'global-pause'];
    advanceWeek(state);
    expect(state.gameOver?.result).toBe('win');
    expect(state.gameOver?.reason).toBe('pause-treaty');
  });
});

describe('small diplomacy actions', () => {
  it('charm reduces race fear and goes on cooldown', () => {
    const state = newGame('helios', 1);
    const fear = state.govs.us.raceFear;
    expect(smallDiplomacy(state, 'charm', 'us').ok).toBe(true);
    expect(state.govs.us.raceFear).toBeLessThan(fear);
    expect(smallDiplomacy(state, 'charm', 'us').ok).toBe(false);
  });

  it('sounding the alarm raises risk fear everywhere and costs revenue', () => {
    const state = newGame('helios', 1);
    state.labs.helios.weeklyRevenue = 100;
    const us = state.govs.us.riskFear;
    const prc = state.govs.prc.riskFear;
    expect(smallDiplomacy(state, 'alarm', null).ok).toBe(true);
    expect(state.govs.us.riskFear).toBeGreaterThan(us);
    expect(state.govs.prc.riskFear).toBeGreaterThan(prc);
    expect(state.labs.helios.lawsuits.length).toBeGreaterThan(0);
  });
});
