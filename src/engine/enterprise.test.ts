import { describe, expect, it } from 'vitest';
import { pursueLead } from './actions';
import { BAL } from './balance';
import { enterpriseTick, leadValue } from './enterprise';
import { licenseDemand, weeklyPnl } from './finance';
import { newGame } from './init';
import { committedChips } from './model';
import { advanceWeek } from './tick';
import type { EnterpriseLead, GameState } from './types';

function testLead(state: GameState, over: Partial<EnterpriseLead> = {}): EnterpriseLead {
  const lead: EnterpriseLead = {
    id: 'lead-test-1',
    name: 'CedarBank',
    fineTune: false,
    cashCost: 50,
    chips: 500,
    odds: 1,
    weeklyPay: 6,
    durationWeeks: 40,
    expiresWeek: state.week + BAL.ENT_LEAD_EXPIRY,
    ...over,
  };
  state.labs.helios.leads.push(lead);
  return lead;
}

describe('enterprise leads', () => {
  it('spawn over time for every alive lab, capped at ENT_MAX_LEADS', () => {
    const state = newGame('helios', 3);
    for (let i = 0; i < 60; i++) {
      state.pendingEvents = []; // blocking events would pause the sim loop
      advanceWeek(state);
    }
    for (const lab of Object.values(state.labs)) {
      expect(lab.leads.length).toBeLessThanOrEqual(BAL.ENT_MAX_LEADS);
    }
    // over 60 weeks at ENT_LEAD_CHANCE the player has seen at least one lead
    const player = state.labs.helios;
    expect(player.leadCounter + player.leads.length + player.enterprise.length).toBeGreaterThan(0);
    expect(player.leadCounter).toBeGreaterThan(0);
  });

  it('leads expire after ENT_LEAD_EXPIRY weeks', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    testLead(state, { expiresWeek: state.week + 1 });
    state.week += 1;
    enterpriseTick(state, lab);
    expect(lab.leads.find((l) => l.id === 'lead-test-1')).toBeUndefined();
  });

  it('pursue pays cash win or lose; success locks chips into a contract', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    const cash = lab.cash;
    const freeBefore = lab.chips - committedChips(lab);
    testLead(state, { odds: 1 });
    const res = pursueLead(state, lab, 'lead-test-1');
    expect(res.ok).toBe(true);
    expect(lab.cash).toBe(cash - 50);
    expect(lab.enterprise).toHaveLength(1);
    expect(lab.enterprise[0].endsWeek).toBe(state.week + 40);
    expect(committedChips(lab)).toBe(lab.chips - freeBefore + 500);
    expect(lab.alloc.inference + lab.alloc.alignment).toBe(lab.chips - committedChips(lab));
  });

  it('failed conversion still costs the cash and signs nothing', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    const cash = lab.cash;
    testLead(state, { odds: 0 });
    const res = pursueLead(state, lab, 'lead-test-1');
    expect(res.ok).toBe(true);
    expect(lab.cash).toBe(cash - 50);
    expect(lab.enterprise).toHaveLength(0);
    expect(lab.leads).toHaveLength(0);
  });

  it('rejects pursuit without cash or free chips', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    testLead(state);
    lab.cash = 10;
    expect(pursueLead(state, lab, 'lead-test-1').ok).toBe(false);
    lab.cash = 5000;
    lab.leads[0].chips = lab.chips + 1;
    expect(pursueLead(state, lab, 'lead-test-1').ok).toBe(false);
    expect(pursueLead(state, lab, 'no-such-lead').ok).toBe(false);
  });

  it('contract revenue lands in the P&L and stops when the contract ends', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    testLead(state, { odds: 1, durationWeeks: 3 });
    pursueLead(state, lab, 'lead-test-1');
    const pnl = weeklyPnl(state, lab, licenseDemand(state));
    expect(pnl.enterpriseRevenue).toBeCloseTo(6, 5);
    expect(pnl.revenue).toBeGreaterThanOrEqual(6);
    state.week += 3;
    enterpriseTick(state, lab);
    expect(lab.enterprise).toHaveLength(0);
    expect(weeklyPnl(state, lab, licenseDemand(state)).enterpriseRevenue).toBe(0);
    // chips released back to the splittable pool
    expect(committedChips(lab)).toBe(lab.contracts.reduce((s, c) => s + c.chips, 0));
  });

  it('fine-tune contracts record the source model as a deployment', () => {
    const state = newGame('helios', 1);
    const lab = state.labs.helios;
    testLead(state, { odds: 1, fineTune: true });
    pursueLead(state, lab, 'lead-test-1');
    expect(lab.enterprise[0].fineTune).toBe(true);
    expect(lab.enterprise[0].modelName).toBe('ENTROPIC-1');
  });

  it('leadValue is the expected net of a lead', () => {
    const state = newGame('helios', 1);
    const lead = testLead(state, { odds: 0.5, weeklyPay: 10, durationWeeks: 40, cashCost: 60 });
    expect(leadValue(lead)).toBeCloseTo(0.5 * 10 * 40 - 60, 5);
  });
});
